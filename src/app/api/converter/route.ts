import JSZip from "jszip";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const maxDuration = 300;

type Cell = string | number | boolean | null;

type XlsJsonBundle = {
  version: 1;
  files: Array<{
    fileName: string;
    sheets: Record<string, Cell[][]>;
  }>;
};

function isXlsName(name: string): boolean {
  return /\.xls$/i.test(name) && !/\.xlsx$/i.test(name);
}

function workbookToJsonSheets(wb: XLSX.WorkBook): Record<string, Cell[][]> {
  const sheets: Record<string, Cell[][]> = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      raw: true,
    }) as unknown[][];
    sheets[name] = rows.map((row) =>
      Array.isArray(row)
        ? row.map((c) =>
            c === undefined || c === "" ? null : (c as Cell),
          )
        : [],
    );
  }
  return sheets;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_");
}

/** Parte de FormData con nombre y cuerpo (evita `instanceof File`: en Node a veces no existe `File`). */
type UploadedXls = {
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function asUploadedXls(v: unknown): UploadedXls | null {
  if (typeof v !== "object" || v === null) return null;
  const name = (v as { name?: unknown }).name;
  if (typeof name !== "string") return null;
  if (typeof (v as { arrayBuffer?: unknown }).arrayBuffer !== "function") {
    return null;
  }
  return v as UploadedXls;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const form = await req.formData();
    const outputRaw = String(form.get("output") ?? "json").toLowerCase();
    const output = outputRaw === "xlsx" ? "xlsx" : "json";
    const entries = form.getAll("files");
    const files = entries
      .map(asUploadedXls)
      .filter((f): f is UploadedXls => f !== null);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Enviá al menos un archivo en el campo files." },
        { status: 400 },
      );
    }

    for (const f of files) {
      if (!isXlsName(f.name)) {
        return NextResponse.json(
          {
            error: `Solo .xls (Excel antiguo): "${f.name}" no es válido.`,
          },
          { status: 400 },
        );
      }
    }

    if (output === "json") {
      const bundle: XlsJsonBundle = { version: 1, files: [] };
      for (const file of files) {
        const buf = Buffer.from(await file.arrayBuffer());
        const wb = XLSX.read(buf, { type: "buffer" });
        bundle.files.push({
          fileName: file.name,
          sheets: workbookToJsonSheets(wb),
        });
      }
      return NextResponse.json(bundle);
    }

    // xlsx
    if (files.length === 1) {
      const file = files[0];
      const buf = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "buffer" });
      const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const base = file.name.replace(/\.xls$/i, "");
      const filename = `${sanitizeFilename(base)}.xlsx`;
      return new NextResponse(new Uint8Array(out), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    }

    const zip = new JSZip();
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "buffer" });
      const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const base = file.name.replace(/\.xls$/i, "");
      zip.file(`${sanitizeFilename(base)}.xlsx`, out);
    }
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
    return new NextResponse(new Uint8Array(zipBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition":
          'attachment; filename*=UTF-8\'\'xlsx_convertidos.zip',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/converter]", e);
    const lower = msg.toLowerCase();
    if (
      lower.includes("body") &&
      (lower.includes("limit") ||
        lower.includes("too large") ||
        lower.includes("max"))
    ) {
      return NextResponse.json(
        {
          error:
            "Cuerpo demasiado grande (probable límite de subida). Probá menos archivos por lote o subí el límite en next.config.",
        },
        { status: 413 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
