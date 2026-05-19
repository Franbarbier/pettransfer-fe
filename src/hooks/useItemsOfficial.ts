"use client";

import { useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@/services/api";

const API = getApiBaseUrl().replace(/\/$/, "");

export type OfficialItem = {
  id: string;
  uuid: string;
  operation_type: string | null;
  airport: string | null;
  country: string | null;
  item_en: string;
  item_es: string;
  price_ref: string | null;
  description_en: string | null;
  description_es: string | null;
  notes: string | null;
};

type ApiResponse = {
  expo: OfficialItem[] | null;
  impo: OfficialItem[] | null;
  expo_pais: string | null;
  impo_pais: string | null;
  orphan: OfficialItem[];
};

export type UseItemsOfficialResult = {
  officialExpoItems: OfficialItem[] | null;
  officialImpoItems: OfficialItem[] | null;
  officialOrphanItems: OfficialItem[];
  officialExpoMatchedPais: string | null;
  officialImpoMatchedPais: string | null;
  officialLoading: boolean;
  refetchOfficial: () => void;
};

export function useItemsOfficial(
  tipo: "expo" | "impo" | "ambas" | "transito",
  origin: string,
  destination: string,
): UseItemsOfficialResult {
  const [expoItems, setExpoItems] = useState<OfficialItem[] | null>(null);
  const [impoItems, setImpoItems] = useState<OfficialItem[] | null>(null);
  const [orphanItems, setOrphanItems] = useState<OfficialItem[]>([]);
  const [expoPais, setExpoPais] = useState<string | null>(null);
  const [impoPais, setImpoPais] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const needsExpo = tipo === "expo" || tipo === "ambas";
    const needsImpo = tipo === "impo" || tipo === "ambas";
    const hasOrigin = origin.trim().length >= 2;
    const hasDest = destination.trim().length >= 2;
    const willFetchExpo = needsExpo && hasOrigin;
    const willFetchImpo = needsImpo && hasDest;

    if (!needsExpo) { setExpoItems(null); setExpoPais(null); }
    if (!needsImpo) { setImpoItems(null); setImpoPais(null); }
    if (!willFetchExpo) { setExpoItems(null); setExpoPais(null); }
    if (!willFetchImpo) { setImpoItems(null); setImpoPais(null); }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);

    const tipoParam =
      willFetchExpo && willFetchImpo
        ? "ambas"
        : willFetchExpo
          ? "expo"
          : willFetchImpo
            ? "impo"
            : "ambas";
    const params = new URLSearchParams({ tipo: tipoParam });
    if (willFetchExpo) params.set("origin", origin.trim());
    if (willFetchImpo) params.set("destination", destination.trim());

    void fetch(`${API}/items-official/by-operation?${params.toString()}`, {
      signal: ac.signal,
    })
      .then(async (res) => {
        if (ac.signal.aborted) return;
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as ApiResponse;
        if (!ac.signal.aborted) {
          if (willFetchExpo) { setExpoItems(data.expo); setExpoPais(data.expo_pais); }
          if (willFetchImpo) { setImpoItems(data.impo); setImpoPais(data.impo_pais); }
          setOrphanItems(data.orphan ?? []);
        }
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          if (willFetchExpo) { setExpoItems(null); setExpoPais(null); }
          if (willFetchImpo) { setImpoItems(null); setImpoPais(null); }
          setOrphanItems([]);
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => { ac.abort(); };
  }, [tipo, origin, destination, refetchKey]);

  return {
    officialExpoItems: expoItems,
    officialImpoItems: impoItems,
    officialOrphanItems: orphanItems,
    officialExpoMatchedPais: expoPais,
    officialImpoMatchedPais: impoPais,
    officialLoading: loading,
    refetchOfficial: () => setRefetchKey((k) => k + 1),
  };
}
