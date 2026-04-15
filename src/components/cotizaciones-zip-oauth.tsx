"use client";

import { getGapi } from "@/lib/gapiDrive";
import {
  downloadDriveFileBlob,
  gatherCotizacionMetasOAuth,
  sanitizePathSegment,
  uniqueZipPaths,
} from "@/lib/driveCotizacionesOAuth";
import JSZip from "jszip";
import { useState } from "react";

type Props = {
  rootFolderId: string | undefined;
  disabled: boolean;
};

export function CotizacionesZipOAuthDownloadButton({
  rootFolderId,
  disabled,
}: Props): React.JSX.Element {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={() => void runZip(rootFolderId, setBusy)}
      className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-neutral-600"
    >
      {busy ? "Generando ZIP…" : "ZIP cotizaciones (OAuth)"}
    </button>
  );
}

async function runZip(
  rootFolderId: string | undefined,
  setBusy: (v: boolean) => void,
): Promise<void> {
  const gapi = getGapi();
  const token = gapi?.client?.getToken?.()?.access_token;
  if (!token) {
    window.alert("Autorizá Drive primero.");
    return;
  }
  setBusy(true);
  try {
    const metas = await gatherCotizacionMetasOAuth(rootFolderId);
    if (metas.length === 0) {
      window.alert(
        "No hay archivos que cumplan la regla (cot impo / cot expo, Excel o PDF).",
      );
      return;
    }
    const zip = new JSZip();
    const parts = await Promise.all(
      metas.map(async (meta) => {
        const { blob, entryName } = await downloadDriveFileBlob(token, meta);
        return {
          path: `cotizaciones/${sanitizePathSegment(entryName)}`,
          blob,
        };
      }),
    );
    const unique = uniqueZipPaths(parts);
    for (const u of unique) {
      zip.file(u.path, u.blob);
    }
    const out = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(out);
    a.download = "cotizaciones.zip";
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e: unknown) {
    window.alert(e instanceof Error ? e.message : String(e));
  } finally {
    setBusy(false);
  }
}
