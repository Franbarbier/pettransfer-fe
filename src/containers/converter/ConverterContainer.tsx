"use client";

import JSZip from "jszip";
import Link from "next/link";
import { useState } from "react";

/** Archivos por request al API (bajá si cada .xls es muy pesado o el lote pasa ~250MB). */
const BATCH_FILE_COUNT = 500;

type OutputMode = "json" | "xlsx";

type XlsJsonBundle = {
  version: 1;
  files: Array<{
    fileName: string;
    sheets: Record<string, (string | number | boolean | null)[][]>;
  }>;
};

function splitIntoBatches(files: File[]): File[][] {
  const batches: File[][] = [];
  for (let i = 0; i < files.length; i += BATCH_FILE_COUNT) {
    batches.push(files.slice(i, i + BATCH_FILE_COUNT));
  }
  return batches;
}

function parseFilenameFromDisposition(res: Response): string {
  const dispo = res.headers.get("content-disposition") ?? "";
  const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(dispo);
  return decodeURIComponent(match?.[1] ?? match?.[2] ?? "").trim();
}

async function appendResponseToMasterZip(
  blob: Blob,
  res: Response,
  master: JSZip,
  batchIndex: number,
): Promise<void> {
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  const isZip =
    ct.includes("application/zip") ||
    ct.includes("application/x-zip-compressed");
  if (isZip) {
    const inner = await JSZip.loadAsync(blob);
    for (const [relPath, entry] of Object.entries(inner.files)) {
      if (entry.dir) continue;
      const data = await entry.async("uint8array");
      master.file(relPath, data);
    }
    return;
  }
  const name =
    parseFilenameFromDisposition(res) || `lote_${batchIndex + 1}.xlsx`;
  master.file(name, await blob.arrayBuffer());
}

export function ConverterContainer(): React.JSX.Element {
  const [output, setOutput] = useState<OutputMode>("json");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <p className="mb-4 text-sm">
        <Link
          href="/"
          className="text-blue-600 underline dark:text-blue-400"
        >
          ← Inicio
        </Link>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">
        Converter .xls
      </h1>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
        Subís uno o muchos <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">.xls</code>{" "}
        y descargás{" "}
        <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">.xlsx</code>{" "}
        (SheetJS) o un JSON con todas las planillas. Límite aproximado{" "}
        <strong>~250&nbsp;MB</strong> por lote; muchos archivos grandes: menos
        por tanda o bajá{" "}
        <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">
          BATCH_FILE_COUNT
        </code>{" "}
        en este archivo.
      </p>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Lotes automáticos de <strong>{BATCH_FILE_COUNT}</strong> archivos; al
        final un solo descargable (JSON unificado o ZIP de xlsx).
      </p>

      {error ? (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="mt-4 text-sm text-green-700 dark:text-green-400">
          {status}
        </p>
      ) : null}

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            setError(null);
            setStatus(null);
            setProgress(null);
            const form = e.currentTarget;
            const input = form.elements.namedItem("files") as HTMLInputElement;
            const fileList = input?.files;
            if (!fileList || fileList.length === 0) {
              setError("Elegí al menos un archivo .xls.");
              return;
            }
            const allFiles = Array.from(fileList);
            const batches = splitIntoBatches(allFiles);
            const total = allFiles.length;
            setBusy(true);
            try {
              if (output === "json") {
                const merged: XlsJsonBundle = { version: 1, files: [] };
                for (let i = 0; i < batches.length; i += 1) {
                  const batch = batches[i];
                  setProgress(
                    `JSON: lote ${i + 1}/${batches.length} (${batch.length} archivos, ${total} total)…`,
                  );
                  const fd = new FormData();
                  fd.set("output", "json");
                  for (const f of batch) fd.append("files", f);
                  const res = await fetch("/api/converter", {
                    method: "POST",
                    body: fd,
                  });
                  const ct = res.headers.get("content-type") ?? "";
                  const text = await res.text();
                  if (!res.ok) {
                    if (ct.includes("application/json")) {
                      try {
                        const j = JSON.parse(text) as { error?: string };
                        setError(
                          j.error ?? `Lote ${i + 1}/${batches.length}: ${text}`,
                        );
                      } catch {
                        setError(`Lote ${i + 1}/${batches.length}: ${text}`);
                      }
                    } else {
                      setError(
                        `Lote ${i + 1}/${batches.length}: ${text.slice(0, 400)}`,
                      );
                    }
                    return;
                  }
                  const part = JSON.parse(text) as XlsJsonBundle;
                  if (!part.files?.length) {
                    setError(`Lote ${i + 1}: respuesta sin files.`);
                    return;
                  }
                  merged.files.push(...part.files);
                }
                const body = JSON.stringify(merged, null, 2);
                const blob = new Blob([body], {
                  type: "application/json;charset=utf-8",
                });
                const outName =
                  total === 1
                    ? `${merged.files[0]?.fileName.replace(/\.xls$/i, "") ?? "cotizacion"}.json`
                    : "cotizaciones.json";
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = outName;
                a.click();
                URL.revokeObjectURL(a.href);
                setStatus(
                  `Listo: ${total} archivo(s) en ${batches.length} lote(s) → JSON unificado`,
                );
                setProgress(null);
                input.value = "";
                return;
              }

              // xlsx
              if (total === 1) {
                setProgress("XLSX: convirtiendo…");
                const fd = new FormData();
                fd.set("output", "xlsx");
                fd.append("files", allFiles[0]);
                const res = await fetch("/api/converter", {
                  method: "POST",
                  body: fd,
                });
                if (!res.ok) {
                  const text = await res.text();
                  const ct = res.headers.get("content-type") ?? "";
                  if (ct.includes("application/json")) {
                    try {
                      const j = JSON.parse(text) as { error?: string };
                      setError(j.error ?? text);
                    } catch {
                      setError(text);
                    }
                  } else {
                    setError(text.slice(0, 400));
                  }
                  return;
                }
                const blob = await res.blob();
                const name =
                  parseFilenameFromDisposition(res) ||
                  `${allFiles[0].name.replace(/\.xls$/i, "")}.xlsx`;
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = name;
                a.click();
                URL.revokeObjectURL(a.href);
                setStatus("Listo: 1 archivo → XLSX");
                setProgress(null);
                input.value = "";
                return;
              }

              const master = new JSZip();
              for (let i = 0; i < batches.length; i += 1) {
                const batch = batches[i];
                setProgress(
                  `XLSX: lote ${i + 1}/${batches.length} (${batch.length} archivos, ${total} total)…`,
                );
                const fd = new FormData();
                fd.set("output", "xlsx");
                for (const f of batch) fd.append("files", f);
                const res = await fetch("/api/converter", {
                  method: "POST",
                  body: fd,
                });
                if (!res.ok) {
                  const text = await res.text();
                  const ct = res.headers.get("content-type") ?? "";
                  if (ct.includes("application/json")) {
                    try {
                      const j = JSON.parse(text) as { error?: string };
                      setError(
                        j.error ?? `Lote ${i + 1}/${batches.length}: ${text}`,
                      );
                    } catch {
                      setError(`Lote ${i + 1}/${batches.length}: ${text}`);
                    }
                  } else {
                    setError(
                      `Lote ${i + 1}/${batches.length}: ${text.slice(0, 400)}`,
                    );
                  }
                  return;
                }
                const blob = await res.blob();
                await appendResponseToMasterZip(blob, res, master, i);
              }
              setProgress("Comprimiendo ZIP final…");
              const zipBlob = await master.generateAsync({ type: "blob" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(zipBlob);
              a.download = "xlsx_convertidos.zip";
              a.click();
              URL.revokeObjectURL(a.href);
              setStatus(
                `Listo: ${total} archivo(s) en ${batches.length} lote(s) → ZIP`,
              );
              setProgress(null);
              input.value = "";
            } finally {
              setBusy(false);
              setProgress(null);
            }
          })();
        }}
      >
        <div>
          <label className="mb-1 block text-sm font-medium">
            Archivos .xls
          </label>
          <input
            name="files"
            type="file"
            accept=".xls,application/vnd.ms-excel"
            multiple
            className="block w-full text-sm"
            disabled={busy}
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Salida</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="out"
              checked={output === "json"}
              onChange={() => setOutput("json")}
              disabled={busy}
            />
            JSON (un archivo con todas las hojas)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="out"
              checked={output === "xlsx"}
              onChange={() => setOutput("xlsx")}
              disabled={busy}
            />
            XLSX (uno por archivo; varios → ZIP)
          </label>
        </fieldset>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {busy ? progress ?? "Procesando…" : "Convertir"}
        </button>
      </form>

      {busy && progress ? (
        <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">
          {progress}
        </p>
      ) : null}

      <p className="mt-8 text-xs text-neutral-500">
        API:{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
          POST /api/converter
        </code>
        . Ajustá{" "}
        <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
          next.config.ts
        </code>{" "}
        si necesitás más de ~250&nbsp;MB por lote.
      </p>
    </main>
  );
}
