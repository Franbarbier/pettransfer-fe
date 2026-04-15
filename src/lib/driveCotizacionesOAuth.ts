import { getGapi } from "@/lib/gapiDrive";
import {
  selectQuotationFile,
  type QuotationPickFile,
} from "@/lib/selectQuotationFile";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const XLSX_EXPORT =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const SHEETS_MIME = "application/vnd.google-apps.spreadsheet";

export function sanitizePathSegment(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "sin_nombre";
}

type GapiDriveList = (p: Record<string, unknown>) => Promise<{
  result?: {
    files?: QuotationPickFile[];
    nextPageToken?: string;
  };
}>;

function getDriveListFn(): GapiDriveList | null {
  const gapi = getGapi() as unknown as {
    client?: { drive?: { files?: { list: GapiDriveList } } };
  };
  const list = gapi?.client?.drive?.files?.list;
  const files = gapi?.client?.drive?.files;
  if (!list || !files) return null;
  return list.bind(files) as GapiDriveList;
}

async function listAllInFolder(
  list: GapiDriveList,
  folderId: string,
  mode: "myDriveRoot" | "explicitFolder",
): Promise<QuotationPickFile[]> {
  const pageSize = 1000;
  const fields = "nextPageToken, files(id,name,mimeType,modifiedTime)";
  const shared = {
    pageSize,
    fields,
    spaces: "drive",
  } as const;

  const paramsBase =
    mode === "explicitFolder"
      ? {
          ...shared,
          q: `'${folderId}' in parents and trashed = false`,
          corpora: "allDrives",
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        }
      : {
          ...shared,
          q: "'root' in parents and trashed = false",
          corpora: "user",
        };

  const out: QuotationPickFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await list({
      ...paramsBase,
      ...(pageToken ? { pageToken } : {}),
    });
    const batch = res.result?.files ?? [];
    out.push(...batch);
    pageToken = res.result?.nextPageToken ?? undefined;
    if (out.length > 100_000) break;
  } while (pageToken);
  return out;
}

export function uniqueZipPaths<T extends { path: string }>(entries: T[]): T[] {
  const used = new Set<string>();
  return entries.map((e) => {
    let path = e.path;
    let n = 2;
    const base = path;
    while (used.has(path)) {
      const dot = base.lastIndexOf(".");
      path =
        dot > 0
          ? `${base.slice(0, dot)}_${n}${base.slice(dot)}`
          : `${base}_${n}`;
      n += 1;
    }
    used.add(path);
    return { ...e, path };
  });
}

/**
 * Un archivo elegido por carpeta de cotización (misma lógica que el ZIP del API).
 */
export async function gatherCotizacionMetasOAuth(
  rootFolderId: string | undefined,
): Promise<QuotationPickFile[]> {
  const list = getDriveListFn();
  if (!list) throw new Error("Cliente Drive no listo o sin token.");

  const explicit = rootFolderId?.trim();
  const mode = explicit ? "explicitFolder" : "myDriveRoot";
  const listId = explicit ?? "root";

  const children = await listAllInFolder(list, listId, mode);
  const subfolders = children.filter(
    (c) => c.mimeType === FOLDER_MIME && c.id,
  );

  const out: QuotationPickFile[] = [];

  if (subfolders.length > 0) {
    for (const folder of subfolders) {
      if (!folder.id) continue;
      const inside = await listAllInFolder(list, folder.id, "explicitFolder");
      const filesOnly = inside.filter((f) => f.mimeType !== FOLDER_MIME);
      const chosen = selectQuotationFile(filesOnly);
      if (chosen) out.push(chosen);
    }
  } else {
    const filesOnly = children.filter((f) => f.mimeType !== FOLDER_MIME);
    const chosen = selectQuotationFile(filesOnly);
    if (chosen) out.push(chosen);
  }

  return out;
}

export async function downloadDriveFileBlob(
  accessToken: string,
  meta: QuotationPickFile,
): Promise<{ blob: Blob; entryName: string }> {
  const mime = meta.mimeType ?? "";
  if (mime === SHEETS_MIME) {
    const url = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(meta.id)}/export`,
    );
    url.searchParams.set("mimeType", XLSX_EXPORT);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(
        `Export Sheets ${meta.name}: ${res.status} ${await res.text()}`,
      );
    }
    const base = meta.name.replace(/\.[^/.]+$/, "") || meta.name;
    return { blob: await res.blob(), entryName: `${base}.xlsx` };
  }

  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(meta.id)}`,
  );
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(
      `Descarga ${meta.name}: ${res.status} ${await res.text()}`,
    );
  }
  return { blob: await res.blob(), entryName: meta.name };
}
