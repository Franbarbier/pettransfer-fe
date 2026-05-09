import { NextResponse } from "next/server";
import { listDropboxFolder } from "@/lib/dropboxStorage";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { folderPath?: string };
    const folderPath = body.folderPath ?? "/";
    const entries = await listDropboxFolder(folderPath);
    return NextResponse.json({ ok: true, entries });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
