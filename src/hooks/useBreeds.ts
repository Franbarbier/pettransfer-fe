"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/services/api";

const API = getApiBaseUrl().replace(/\/$/, "");

export type Breed = {
  id: number;
  name_es: string;
  name_en: string;
  type: "perro" | "gato";
  braqui: boolean;
  danger: boolean;
};

let cachedBreeds: Breed[] | null = null;

export function useBreeds(): { breeds: Breed[]; breedsLoading: boolean } {
  const [breeds, setBreeds] = useState<Breed[]>(cachedBreeds ?? []);
  const [loading, setLoading] = useState(cachedBreeds === null);

  useEffect(() => {
    if (cachedBreeds !== null) return;
    let cancelled = false;
    void fetch(`${API}/breeds`)
      .then((r) => r.json())
      .then((data: Breed[]) => {
        if (cancelled) return;
        cachedBreeds = data;
        setBreeds(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { breeds, breedsLoading: loading };
}
