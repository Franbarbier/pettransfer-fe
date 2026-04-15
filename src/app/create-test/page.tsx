"use client";

import { useState } from "react";

const apiBase =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8080";

export default function CreateTestPage(): React.JSX.Element {
  const [status, setStatus] = useState<string>("");
  const [listJson, setListJson] = useState<string>("");
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  async function onSeed(): Promise<void> {
    setLoadingSeed(true);
    setStatus("");
    try {
      const res = await fetch(`${apiBase}/quotes/seed-test`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const body: unknown = await res.json().catch(() => ({}));
      const text =
        typeof body === "object" && body !== null && "error" in body
          ? String((body as { error: unknown }).error)
          : JSON.stringify(body, null, 2);
      if (!res.ok) {
        setStatus(`Error ${res.status}: ${text}`);
        return;
      }
      setStatus(text);
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingSeed(false);
    }
  }

  async function onListQuotes(): Promise<void> {
    setLoadingList(true);
    setListJson("");
    try {
      const res = await fetch(`${apiBase}/quotes`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          typeof body === "object" && body !== null && "error" in body
            ? String((body as { error: unknown }).error)
            : JSON.stringify(body);
        setListJson(`Error ${res.status}: ${err}`);
        return;
      }
      setListJson(JSON.stringify(body, null, 2));
    } catch (e: unknown) {
      setListJson(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingList(false);
    }
  }

  const panelPre =
    "max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border p-3 font-mono leading-relaxed " +
    "border-zinc-300 bg-zinc-100 text-zinc-900 " +
    "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8 text-zinc-900 dark:text-zinc-100">
      <h1 className="text-xl font-semibold">Create test quote</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Inserta la fila de ejemplo Q00001 en Postgres vía la API. Requiere{" "}
        <code className="rounded bg-zinc-200 px-1 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200">
          DATABASE_URL
        </code>{" "}
        en la API y la migración{" "}
        <code className="rounded bg-zinc-200 px-1 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200">
          001_quotes.sql
        </code>{" "}
        aplicada.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loadingSeed}
          onClick={() => void onSeed()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loadingSeed ? "Enviando…" : "Crear fila de prueba (Q00001)"}
        </button>
        <button
          type="button"
          disabled={loadingList}
          onClick={() => void onListQuotes()}
          className="rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {loadingList ? "Cargando…" : "Listar todas las quotes (GET)"}
        </button>
      </div>
      {status ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Respuesta seed
          </h2>
          <pre
            className={`${panelPre} max-h-64 text-sm`}
          >
            {status}
          </pre>
        </section>
      ) : null}
      {listJson ? (
        <section>
          <h2 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            GET /quotes
          </h2>
          <pre className={`${panelPre} text-xs`}>{listJson}</pre>
        </section>
      ) : null}
    </main>
  );
}
