"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGapi } from "@/lib/gapiDrive";
import type { DriveFileItem } from "@/types/drive";

export { getGapi, getGapiDriveListOrNull } from "@/lib/gapiDrive";

const DRIVE_DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

const DRIVE_SCOPES =
  "https://www.googleapis.com/auth/drive.readonly";

const GAPI_SCRIPT = "https://apis.google.com/js/api.js";
const GIS_SCRIPT = "https://accounts.google.com/gsi/client";

const DRIVE_LIST_FIELDS =
  "nextPageToken, files(id,name,mimeType,hasThumbnail,thumbnailLink,iconLink,webViewLink,viewedByMeTime,modifiedTime,parents)";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load: ${src}`)),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () =>
      reject(new Error(`Failed to load: ${src}`)),
    );
    document.body.appendChild(script);
  });
}

type GoogleAccountsWindow = Window & {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (args: {
          client_id: string;
          scope: string;
          callback: (resp: { error?: string }) => void;
        }) => {
          requestAccessToken: (opts: { prompt?: string }) => void;
          callback: (resp: { error?: string }) => void;
        };
        revoke: (token: string) => void;
      };
    };
  };
};

function getGoogleAccounts(): GoogleAccountsWindow["google"] | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as GoogleAccountsWindow).google;
}

function getClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
}

function getOptionalFolderId(): string | undefined {
  const v = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID;
  return v && v.trim() ? v.trim() : undefined;
}

type TokenClient = {
  requestAccessToken: (opts: { prompt?: string }) => void;
  callback: (resp: { error?: string }) => void;
};

export function useGoogleDrive() {
  const clientId = getClientId();
  const folderId = getOptionalFolderId();

  const [gapiReady, setGapiReady] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFileItem[]>([]);

  const tokenClientRef = useRef<TokenClient | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        await loadScript(GAPI_SCRIPT);
        await loadScript(GIS_SCRIPT);
        if (cancelled) return;

        const gapi = getGapi();
        if (!gapi) {
          setError("gapi no disponible tras cargar el script.");
          return;
        }

        await new Promise<void>((resolve, reject) => {
          gapi.load("client", () => {
            gapi.client
              .init({ discoveryDocs: [DRIVE_DISCOVERY_DOC] })
              .then(() => resolve())
              .catch(reject);
          });
        });
        if (cancelled) return;
        setGapiReady(true);

        const google = getGoogleAccounts();
        if (!google || !clientId) {
          if (!clientId) {
            setError("Definí NEXT_PUBLIC_GOOGLE_CLIENT_ID en .env.local");
          } else {
            setError("Google Identity Services no cargó.");
          }
          return;
        }

        tokenClientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPES,
          callback: () => {},
        }) as TokenClient;
        setGisReady(true);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const listFiles = useCallback(async () => {
    const gapi = getGapi() as unknown as {
      client: {
        drive: {
          files: {
            list: (p: Record<string, unknown>) => Promise<{
              result?: {
                files?: DriveFileItem[];
                nextPageToken?: string;
              };
            }>;
          };
        };
      };
    };
    if (!gapi?.client?.drive?.files?.list) {
      setError("Cliente Drive no inicializado.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Drive devuelve como máximo pageSize ítems por llamada; hay que seguir nextPageToken.
      const pageSize = 1000;
      const baseParams: Record<string, unknown> = {
        pageSize,
        fields: DRIVE_LIST_FIELDS,
        orderBy: "viewedByMeTime desc",
      };

      const listWithFolder = (pageToken?: string) =>
        gapi.client.drive.files.list({
          ...baseParams,
          q: `'${folderId}' in parents and trashed = false`,
          corpora: "allDrives",
          spaces: "drive",
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
          ...(pageToken ? { pageToken } : {}),
        });

      const listMyDrive = (pageToken?: string) =>
        gapi.client.drive.files.list({
          ...baseParams,
          q: "trashed = false",
          corpora: "user",
          spaces: "drive",
          ...(pageToken ? { pageToken } : {}),
        });

      const fetched: DriveFileItem[] = [];
      let pageToken: string | undefined;

      do {
        const response = folderId
          ? await listWithFolder(pageToken)
          : await listMyDrive(pageToken);
        const batch = response.result?.files ?? [];
        fetched.push(...batch);
        pageToken = response.result?.nextPageToken;
        // Límite de seguridad (~100k ítems) por si algo devolviera token inválido en bucle
        if (fetched.length > 100_000) break;
      } while (pageToken);
      const folderMime = "application/vnd.google-apps.folder";
      const sorted = [...fetched].sort((a, b) => {
        const aFolder = a.mimeType === folderMime ? 0 : 1;
        const bFolder = b.mimeType === folderMime ? 0 : 1;
        if (aFolder !== bFolder) return aFolder - bFolder;
        return (a.name || "").localeCompare(b.name || "", undefined, {
          sensitivity: "base",
        });
      });
      console.log(
        "[Drive list] length (suma de todas las páginas):",
        sorted.length,
        folderId
          ? { parentFolderId: folderId }
          : { scope: "Mi unidad (q: trashed = false)" },
      );
      setFiles(sorted);
    } catch (err: unknown) {
      const details =
        err &&
        typeof err === "object" &&
        "result" in err &&
        err.result &&
        typeof err.result === "object" &&
        "error" in err.result
          ? (err.result as { error: unknown }).error
          : err instanceof Error
            ? err.message
            : String(err);
      setError(
        typeof details === "string"
          ? details
          : JSON.stringify(details, null, 2),
      );
      setFiles([]);
    } finally {
      setBusy(false);
    }
  }, [folderId]);

  const requestAccess = useCallback(async () => {
    const gapi = getGapi();
    const tokenClient = tokenClientRef.current;
    if (!gapi || !tokenClient) return;

    tokenClient.callback = async (resp: { error?: string }) => {
      if (resp?.error) {
        setError(resp.error);
        setAuthorized(false);
        return;
      }
      setAuthorized(true);
      setError(null);
      await listFiles();
    };

    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: "consent" });
    } else {
      tokenClient.requestAccessToken({ prompt: "" });
    }
  }, [listFiles]);

  const signOut = useCallback(() => {
    const gapi = getGapi();
    const google = getGoogleAccounts();
    const token = gapi?.client?.getToken?.();
    if (token?.access_token) {
      try {
        google?.accounts?.oauth2?.revoke?.(token.access_token);
      } catch {
        /* ignore */
      }
      gapi?.client?.setToken?.("");
    }
    setAuthorized(false);
    setFiles([]);
    setError(null);
  }, []);

  const scriptsReady = gapiReady && gisReady && Boolean(clientId);

  return {
    clientIdConfigured: Boolean(clientId),
    folderId,
    gapiReady,
    gisReady,
    scriptsReady,
    authorized,
    busy,
    error,
    files,
    listFiles,
    requestAccess,
    signOut,
  };
}
