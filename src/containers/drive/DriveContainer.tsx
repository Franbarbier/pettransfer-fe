"use client";

import Link from "next/link";
import { DriveFilesPanel } from "@/components/drive-files-panel";

export function DriveContainer(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <nav>
        <Link
          href="/"
          className="text-sm text-blue-600 underline dark:text-blue-400"
        >
          ← Inicio
        </Link>
      </nav>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Google Drive</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          OAuth en el navegador (GIS + gapi.client) con permiso{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">drive.readonly</code>
          . Tras autorizar se llama a{" "}
          <code className="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-900">files.list</code>.
        </p>
      </header>
      <DriveFilesPanel />
    </div>
  );
}
