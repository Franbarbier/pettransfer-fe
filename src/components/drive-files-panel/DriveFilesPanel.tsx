"use client";

import { CotizacionesFiltradasConsolaButton } from "@/components/cotizaciones-filtradas-consola";
import { CotizacionesZipOAuthDownloadButton } from "@/components/cotizaciones-zip-oauth";
import { CotizacionesZipDownloadButton } from "@/components/cotizaciones-zip-download";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";
import { getGapi } from "@/lib/gapiDrive";
import type { DriveFileItem } from "@/types/drive";

const FOLDER_MIME = "application/vnd.google-apps.folder";

function isFolder(f: DriveFileItem): boolean {
  return f.mimeType === FOLDER_MIME;
}

function thumbnailSrc(file: DriveFileItem, accessToken: string | undefined): string | undefined {
  const raw = file.thumbnailLink || file.iconLink;
  if (!raw) return undefined;
  if (!accessToken) return raw;
  const hasQuery = raw.includes("?");
  const hasToken = raw.includes("access_token=");
  if (hasToken) return raw;
  return `${raw}${hasQuery ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;
}

export function DriveFilesPanel(): React.JSX.Element {
  const {
    scriptsReady,
    clientIdConfigured,
    authorized,
    busy,
    error,
    files,
    folderId,
    requestAccess,
    signOut,
    listFiles,
  } = useGoogleDrive();

  const gapiToken = getGapi()?.client?.getToken?.()?.access_token;

  return (
    <div className="space-y-4">
      {!clientIdConfigured ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Configurá <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> en{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">.env.local</code> y reiniciá el dev server.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void requestAccess()}
          disabled={!scriptsReady || busy}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {!scriptsReady ? "Cargando Google…" : authorized ? "Actualizar lista" : "Autorizar y listar"}
        </button>
        <button
          type="button"
          onClick={signOut}
          disabled={!authorized}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-neutral-600"
        >
          Cerrar sesión
        </button>
        <button
          type="button"
          onClick={() => void listFiles()}
          disabled={!authorized || busy}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-neutral-600"
        >
          {busy ? "Leyendo…" : "Solo listar de nuevo"}
        </button>
        <CotizacionesFiltradasConsolaButton
          rootFolderId={folderId}
          disabled={!authorized || busy}
        />
        <CotizacionesZipOAuthDownloadButton
          rootFolderId={folderId}
          disabled={!authorized || busy}
        />
      </div>

      <div className="rounded-lg border border-neutral-200 border-dashed p-4 dark:border-neutral-700">
        <p className="mb-3 text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Descarga vía API (cuenta de servicio)
        </p>
        <CotizacionesZipDownloadButton />
      </div>

      {authorized && files.length > 0 ? (
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          Mostrando <strong>{files.length}</strong> ítems (todas las páginas de la API).
        </p>
      ) : null}

      {folderId ? (
        <p className="text-xs text-neutral-500">
          Carpeta configurada (env): <code className="break-all">{folderId}</code>
          . Se listan <strong>archivos y subcarpetas</strong> de ese nivel (no es recursivo).
        </p>
      ) : (
        <p className="text-xs text-neutral-500">
          Sin carpeta fija: el listado usa Mi unidad; cotizaciones (consola / ZIP OAuth)
          usan la raíz <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">root</code>{" "}
          (todas las carpetas de primer nivel).
        </p>
      )}

      {error ? (
        <pre className="overflow-x-auto rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </pre>
      ) : null}

      {files.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {files.map((f) => {
            const folder = isFolder(f);
            const thumb = folder ? undefined : thumbnailSrc(f, gapiToken);
            return (
              <li
                key={f.id}
                className="flex gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
                  {folder ? (
                    <span className="text-2xl" title="Carpeta">
                      📁
                    </span>
                  ) : thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- thumbnail externo OAuth
                    <img
                      src={thumb}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-neutral-400">sin miniatura</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {folder ? (
                      <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                        Carpeta
                      </span>
                    ) : null}
                    {f.name}
                  </p>
                  <p className="truncate text-xs text-neutral-500">{f.mimeType}</p>
                  {f.webViewLink ? (
                    <a
                      href={f.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 underline dark:text-blue-400"
                    >
                      Abrir en Drive
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : authorized && !busy && !error ? (
        <p className="text-sm text-neutral-500">
          No hay archivos ni carpetas en este nivel (o no tenés permiso de lectura).
        </p>
      ) : null}
    </div>
  );
}
