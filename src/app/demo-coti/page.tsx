"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type LocationSuggestOption,
  parseLocationSuggestList,
} from "@/lib/quoteLocationSuggestions";

const apiBase =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8080";

type QuoteItemDetailJson = {
  detail_order: number;
  detail_text: string;
};

type QuoteItemJson = {
  quote_item_id: string;
  quote_id: string;
  item_number: number | null;
  display_order: number;
  item_name_raw: string;
  item_catalog_id: string;
  item_display_name: string;
  price_raw: string;
  price_amount: string;
  currency: string;
  inline_note: string | null;
  is_zero_priced: boolean;
  crate_size: number | null;
  details: QuoteItemDetailJson[];
};

type QuoteRow = {
  import_key: string;
  source_filename: string;
  source_sheet: string | null;
  customer_name: string | null;
  origin: string | null;
  destination: string | null;
  formatted_origin?: string | null;
  formatted_destination?: string | null;
  quotation_date_raw: string | null;
  formatted_quotation_date: string | null;
  travel_date_raw: string | null;
  formatted_travel_date: string | null;
  quoted_total_raw: string | null;
  quoted_total_amount: string | null;
  currency: string | null;
  shipment_mode: string | null;
  created_at: string;
  items?: QuoteItemJson[];
};

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function DemoCotiPage(): React.JSX.Element {
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [originOpen, setOriginOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [originSuggestions, setOriginSuggestions] = useState<
    LocationSuggestOption[]
  >([]);
  const [destSuggestions, setDestSuggestions] = useState<
    LocationSuggestOption[]
  >([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loadingSuggestO, setLoadingSuggestO] = useState(false);
  const [loadingSuggestD, setLoadingSuggestD] = useState(false);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const originWrapRef = useRef<HTMLDivElement>(null);
  const destWrapRef = useRef<HTMLDivElement>(null);

  const debouncedOrigin = useDebounced(originText, 280);
  const debouncedDest = useDebounced(destText, 280);

  const fetchOriginSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setOriginSuggestions([]);
      return;
    }
    setLoadingSuggestO(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: q.trim() });
      const res = await fetch(
        `${apiBase}/quotes/suggest/origins?${params.toString()}`,
      );
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          typeof body === "object" && body !== null && "error" in body
            ? String((body as { error: unknown }).error)
            : res.statusText;
        setError(err);
        setOriginSuggestions([]);
        return;
      }
      const rawOrigins =
        typeof body === "object" &&
        body !== null &&
        "origins" in body
          ? (body as { origins: unknown }).origins
          : [];
      setOriginSuggestions(parseLocationSuggestList(rawOrigins));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setOriginSuggestions([]);
    } finally {
      setLoadingSuggestO(false);
    }
  }, []);

  const fetchDestSuggestions = useCallback(async (q: string) => {
      if (q.trim().length < 2) {
        setDestSuggestions([]);
        return;
      }
      setLoadingSuggestD(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q: q.trim() });
        const res = await fetch(
          `${apiBase}/quotes/suggest/destinations?${params.toString()}`,
        );
        const body: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err =
            typeof body === "object" && body !== null && "error" in body
              ? String((body as { error: unknown }).error)
              : res.statusText;
          setError(err);
          setDestSuggestions([]);
          return;
        }
        const rawDests =
          typeof body === "object" &&
          body !== null &&
          "destinations" in body
            ? (body as { destinations: unknown }).destinations
            : [];
        setDestSuggestions(parseLocationSuggestList(rawDests));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        setDestSuggestions([]);
      } finally {
        setLoadingSuggestD(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchOriginSuggestions(debouncedOrigin);
  }, [debouncedOrigin, fetchOriginSuggestions]);

  useEffect(() => {
    void fetchDestSuggestions(debouncedDest);
  }, [debouncedDest, fetchDestSuggestions]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (originWrapRef.current && !originWrapRef.current.contains(t)) {
        setOriginOpen(false);
      }
      if (destWrapRef.current && !destWrapRef.current.contains(t)) {
        setDestOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const searchQuotes = useCallback(async (oRaw: string, dRaw: string) => {
    const o = oRaw.trim();
    if (o.length === 0) {
      setError("Completá el origen.");
      return;
    }
    setLoadingQuotes(true);
    setError(null);
    try {
      const params = new URLSearchParams({ origin: o });
      const d = dRaw.trim();
      if (d.length > 0) {
        params.set("destination", d);
      }
      params.set("limit", "100");
      const res = await fetch(`${apiBase}/quotes/search?${params.toString()}`);
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          typeof body === "object" && body !== null && "error" in body
            ? String((body as { error: unknown }).error)
            : res.statusText;
        setError(err);
        setQuotes([]);
        return;
      }
      const list =
        typeof body === "object" &&
        body !== null &&
        "quotes" in body &&
        Array.isArray((body as { quotes: unknown }).quotes)
          ? ((body as { quotes: QuoteRow[] }).quotes)
          : [];
      setQuotes(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setQuotes([]);
    } finally {
      setLoadingQuotes(false);
    }
  }, []);

  const runSearch = useCallback(async () => {
    await searchQuotes(originText, destText);
  }, [originText, destText, searchQuotes]);

  return (
    <main className="mx-auto max-w-5xl p-6 text-zinc-900 dark:text-zinc-100">
      <h1 className="text-xl font-semibold">Demo cotizaciones similares</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Origen y destino: al menos 2 caracteres para sugerencias desde la base.
        En el menú se muestra el texto normalizado (
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">
          formatted_origin
        </code>{" "}
        /{" "}
        <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">
          formatted_destination
        </code>
        ); al elegir, la búsqueda usa el valor crudo guardado. Si ya hay origen,
        las sugerencias de destino se acotan a cotizaciones con ese origen.
      </p>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div ref={originWrapRef} className="relative min-w-[240px] flex-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Origen
          </label>
          <input
            type="text"
            autoComplete="off"
            value={originText}
            onChange={(e) => {
              setOriginText(e.target.value);
              setOriginOpen(true);
            }}
            onFocus={() => setOriginOpen(true)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="Ej. EZE"
          />
          {originOpen &&
            originText.trim().length >= 2 &&
            (originSuggestions.length > 0 || loadingSuggestO) && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-600 dark:bg-zinc-900">
                {loadingSuggestO && (
                  <li className="px-3 py-2 text-zinc-500">Buscando…</li>
                )}
                {originSuggestions.map((s) => (
                  <li key={s.value}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setOriginText(s.value);
                        setOriginOpen(false);
                        setDestText("");
                        void searchQuotes(s.value, "");
                      }}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>

        <div ref={destWrapRef} className="relative min-w-[240px] flex-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Destino (opcional)
          </label>
          <input
            type="text"
            autoComplete="off"
            value={destText}
            onChange={(e) => {
              setDestText(e.target.value);
              setDestOpen(true);
            }}
            onFocus={() => setDestOpen(true)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="Ej. MIA — sugerencias de todos los destinos en la base"
          />
          {destOpen &&
            destText.trim().length >= 2 &&
            (destSuggestions.length > 0 || loadingSuggestD) && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-600 dark:bg-zinc-900">
                {loadingSuggestD && (
                  <li className="px-3 py-2 text-zinc-500">Buscando…</li>
                )}
                {destSuggestions.map((s) => (
                  <li key={s.value}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setDestText(s.value);
                        setDestOpen(false);
                        void searchQuotes(originText, s.value);
                      }}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>

        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={loadingQuotes || originText.trim().length === 0}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loadingQuotes ? "Buscando…" : "Buscar cotizaciones"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Origen</th>
              <th className="px-3 py-2 font-medium">Destino</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Fecha cot. (orig.)</th>
              <th className="px-3 py-2 font-medium">Fecha cot. (dd/mm)</th>
              <th className="px-3 py-2 font-medium">Viaje (orig.)</th>
              <th className="px-3 py-2 font-medium">Viaje (dd/mm)</th>
            </tr>
          </thead>
          <tbody>
            {loadingQuotes ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  Cargando cotizaciones…
                </td>
              </tr>
            ) : quotes.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  Sin resultados. Elegí origen y buscá.
                </td>
              </tr>
            ) : (
            quotes.map((q) => (
              <tr
                key={q.import_key}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-3 py-2 font-mono text-xs">{q.import_key}</td>
                <td className="max-w-[140px] truncate px-3 py-2" title={q.origin ?? ""}>
                  {q.formatted_origin ?? q.origin ?? "—"}
                </td>
                <td
                  className="max-w-[140px] truncate px-3 py-2"
                  title={q.destination ?? ""}
                >
                  {q.formatted_destination ?? q.destination ?? "—"}
                </td>
                <td
                  className="max-w-[160px] truncate px-3 py-2"
                  title={q.customer_name ?? ""}
                >
                  {q.customer_name ?? "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {q.quoted_total_raw ??
                    (q.quoted_total_amount != null
                      ? String(q.quoted_total_amount)
                      : "—")}
                  {q.currency ? ` ${q.currency}` : ""}
                </td>
                <td className="max-w-[160px] px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                  {q.quotation_date_raw ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200">
                  {q.formatted_quotation_date ?? "—"}
                </td>
                <td className="max-w-[160px] px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                  {q.travel_date_raw ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200">
                  {q.formatted_travel_date ?? "—"}
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>

      {!loadingQuotes && quotes.length > 0 ? (
        <>
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Ítems y detalles ({quotes.length} cotizaciones)
            </h2>
            <div className="space-y-6">
              {quotes.map((q) => {
                const items = [...(q.items ?? [])].sort(
                  (a, b) => a.display_order - b.display_order,
                );
                return (
                  <div
                    key={q.import_key}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700"
                  >
                    <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
                      <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        {q.import_key}
                      </span>
                      <span className="mx-2 text-zinc-400">·</span>
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {q.formatted_origin ?? q.origin ?? "—"} →{" "}
                        {q.formatted_destination ?? q.destination ?? "—"}
                      </span>
                    </div>
                    {items.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                        Sin ítems en la respuesta.
                      </p>
                    ) : (
                      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {items.map((it) => {
                          const det = [...it.details].sort(
                            (a, b) => a.detail_order - b.detail_order,
                          );
                          const priceLine = [
                            it.price_raw || it.price_amount,
                            it.currency,
                          ]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            <li key={it.quote_item_id} className="px-3 py-3">
                              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {it.item_name_raw || it.item_display_name}
                              </div>
                              {it.inline_note ? (
                                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                                  {it.inline_note}
                                </p>
                              ) : null}
                              {priceLine ? (
                                <p className="mt-1 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                                  {priceLine}
                                </p>
                              ) : null}
                              {det.length > 0 ? (
                                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                                  {det.map((d) => (
                                    <li
                                      key={`${it.quote_item_id}-${d.detail_order}`}
                                      className="pl-0.5"
                                    >
                                      {d.detail_text}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-2 text-xs italic text-zinc-500 dark:text-zinc-500">
                                  Sin detalles.
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Detalle JSON ({quotes.length} cotizaciones; incluye{" "}
              <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">items</code>{" "}
              y{" "}
              <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">details</code>{" "}
              por ítem)
            </h2>
            <pre
              className="max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-300 bg-zinc-100 p-3 font-mono text-xs leading-relaxed text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {JSON.stringify(quotes, null, 2)}
            </pre>
          </section>
        </>
      ) : null}
    </main>
  );
}
