"use client";

import { useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@/services/api";

const API = getApiBaseUrl().replace(/\/$/, "");

const JAULA_KEYS = ["jaulas", "pre_entrega_de_la_jaula"] as const;

type ExpoItem = {
  id: string;
  item_key: string;
  note: string;
  description_en: string | null;
  description_es: string | null;
  sort_order: number;
};

type ExpoOriginData = {
  country: string;
  label: string;
  notes: string[];
  items: ExpoItem[];
};

export type LatamProfitFieldRow = { key: string; clarification: string; description_en: string | null; description_es: string | null };

type UseExpoItemsResult = {
  latamJaulasHint: { countryKey: string; label: string; jaulas: string } | null;
  latamPreEntregaHint: { countryKey: string; label: string; note: string } | null;
  latamProfitFields: { countryKey: string; label: string; fields: LatamProfitFieldRow[] } | null;
  expoLoading: boolean;
};

export function useExpoItems(origin: string): UseExpoItemsResult {
  const [data, setData] = useState<ExpoOriginData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = origin.trim();
    if (!trimmed) {
      setData(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);

    void fetch(`${API}/expo/items-by-origin?origin=${encodeURIComponent(trimmed)}`, {
      signal: ac.signal,
    })
      .then(async (res) => {
        if (ac.signal.aborted) return;
        if (res.status === 404) { setData(null); return; }
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const json = (await res.json()) as ExpoOriginData;
        setData(json);
      })
      .catch(() => { if (!ac.signal.aborted) setData(null); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });

    return () => { ac.abort(); };
  }, [origin]);

  if (!data) {
    return { latamJaulasHint: null, latamPreEntregaHint: null, latamProfitFields: null, expoLoading: loading };
  }

  const jaulasItem = data.items.find((i) => i.item_key === "jaulas");
  const preEntregaItem = data.items.find((i) => i.item_key === "pre_entrega_de_la_jaula");

  const latamJaulasHint = jaulasItem
    ? { countryKey: data.country, label: data.label, jaulas: jaulasItem.note }
    : null;

  const latamPreEntregaHint = preEntregaItem
    ? { countryKey: data.country, label: data.label, note: preEntregaItem.note }
    : null;

  const fields: LatamProfitFieldRow[] = data.items
    .filter((i) => !(JAULA_KEYS as readonly string[]).includes(i.item_key))
    .map((i) => ({ key: i.item_key, clarification: i.note, description_en: i.description_en, description_es: i.description_es }));

  const latamProfitFields = { countryKey: data.country, label: data.label, fields };

  return { latamJaulasHint, latamPreEntregaHint, latamProfitFields, expoLoading: loading };
}
