"use client";

import { getApiBaseUrl } from "@/services/api";
import { useState } from "react";

export function CotizacionesZipDownloadButton(): React.JSX.Element {
  const [folderId, setFolderId] = useState("");
  const [busy, setBusy] = useState(false);

  const onClick = (): void => {
    void (async () => {
      setBusy(true);
      try {
        const base = getApiBaseUrl().replace(/\/$/, "");
        const q = folderId.trim()
          ? `?rootFolderId=${encodeURIComponent(folderId.trim())}`
          : "";
        const res = await fetch(`${base}/drive/cotizaciones-zip${q}`);
        const ct = res.headers.get("Content-Type") ?? "";
        if (!res.ok) {
          const errJson = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(errJson?.error ?? res.statusText);
        }
        if (!ct.includes("zip") && !ct.includes("octet-stream")) {
          const text = await res.text();
          throw new Error(text || "Respuesta inesperada (no es ZIP).");
        }
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "cotizaciones.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (e: unknown) {
        window.alert(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
        <span>Folder ID (opcional)</span>
        <input
          type="text"
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          placeholder="Vacío = DRIVE_COTIZACIONES_ROOT_FOLDER_ID en API"
          className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {busy ? "Descargando…" : "Descargar ZIP (API)"}
      </button>
    </div>
  );
}
