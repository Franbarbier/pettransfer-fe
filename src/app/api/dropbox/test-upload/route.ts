import { NextRequest, NextResponse } from "next/server";

import {
  getDropboxConfigError,
  uploadPdfToDropbox,
} from "@/lib/dropboxStorage";

export const runtime = "nodejs";

type DropboxTestUploadBody = {
  pdfBase64: string;
  filename?: string;
  folderPath?: string;
};

export async function POST(req: NextRequest) {
  const configError = getDropboxConfigError();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 503 });
  }

  let body: DropboxTestUploadBody;
  try {
    body = (await req.json()) as DropboxTestUploadBody;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const pdfBase64 = body.pdfBase64?.trim();
  if (!pdfBase64) {
    return NextResponse.json(
      { error: "Falta pdfBase64." },
      { status: 400 },
    );
  }

  const filename =
    body.filename?.trim() || `dropbox-test-${new Date().toISOString().slice(0, 10)}.pdf`;

  try {
    const buffer = Buffer.from(pdfBase64, "base64");
    const upload = await uploadPdfToDropbox({
      buffer,
      filename,
      folderPath: body.folderPath,
    });

    return NextResponse.json({
      ok: true,
      upload,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Dropbox upload error: ${message}` },
      { status: 500 },
    );
  }
}
