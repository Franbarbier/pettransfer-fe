import { NextRequest, NextResponse } from "next/server";

import {
  createDropboxFolder,
  deleteDropboxPath,
  getDropboxConfigError,
  moveDropboxPath,
} from "@/lib/dropboxStorage";

export const runtime = "nodejs";

type DropboxFolderBody =
  | {
      action: "create";
      folderPath: string;
    }
  | {
      action: "move";
      fromPath: string;
      toPath: string;
    }
  | {
      action: "delete";
      path: string;
    };

export async function POST(req: NextRequest) {
  const configError = getDropboxConfigError();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 503 });
  }

  let body: DropboxFolderBody;
  try {
    body = (await req.json()) as DropboxFolderBody;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  try {
    if (body.action === "create") {
      const folderPath = body.folderPath?.trim();
      if (!folderPath) {
        return NextResponse.json(
          { error: "Falta folderPath." },
          { status: 400 },
        );
      }

      const folder = await createDropboxFolder(folderPath);
      return NextResponse.json({ ok: true, folder });
    }

    if (body.action === "move") {
      const fromPath = body.fromPath?.trim();
      const toPath = body.toPath?.trim();
      if (!fromPath || !toPath) {
        return NextResponse.json(
          { error: "Faltan fromPath o toPath." },
          { status: 400 },
        );
      }

      const moved = await moveDropboxPath(fromPath, toPath);
      return NextResponse.json({ ok: true, moved });
    }

    if (body.action === "delete") {
      const path = body.path?.trim();
      if (!path) {
        return NextResponse.json({ error: "Falta path." }, { status: 400 });
      }
      const deleted = await deleteDropboxPath(path);
      return NextResponse.json({ ok: true, deleted });
    }

    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Dropbox folder error: ${message}` },
      { status: 500 },
    );
  }
}
