import raw from "@/data/latam_profit_transport_by_country.json";

type CountryBundle = {
  label: string;
  items: Record<string, string>[];
  notes?: string[];
};

type Root = { countries: Record<string, CountryBundle> };

const root = raw as Root;

function normalizeLoose(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function originMatchesLabel(origin: string, label: string): boolean {
  const a = normalizeLoose(origin);
  const b = normalizeLoose(label);
  if (a.length === 0 || b.length === 0) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

/**
 * Si el origen coincide con algún `countries.*.label`, devuelve el texto de la entrada `jaulas` de ese país.
 */
export function findJaulasNoteForOrigin(
  originRaw: string,
): { countryKey: string; label: string; jaulas: string } | null {
  const origin = originRaw.trim();
  if (!origin) return null;

  for (const [countryKey, bundle] of Object.entries(root.countries)) {
    if (!originMatchesLabel(origin, bundle.label)) continue;
    for (const item of bundle.items) {
      if (item && typeof item.jaulas === "string" && item.jaulas.length > 0) {
        return {
          countryKey,
          label: bundle.label,
          jaulas: item.jaulas,
        };
      }
    }
  }
  return null;
}

export type LatamProfitFieldRow = {
  key: string;
  clarification: string;
};

/**
 * Ítems de `latam_profit_transport_by_country` para el país del origen.
 * Omite la clave `jaulas` (se muestra aparte con `findJaulasNoteForOrigin`).
 */
export function getLatamProfitFieldsExcludingJaulas(
  originRaw: string,
): {
  countryKey: string;
  label: string;
  fields: LatamProfitFieldRow[];
} | null {
  const origin = originRaw.trim();
  if (!origin) return null;

  for (const [countryKey, bundle] of Object.entries(root.countries)) {
    if (!originMatchesLabel(origin, bundle.label)) continue;
    const fields: LatamProfitFieldRow[] = [];
    for (const item of bundle.items) {
      if (!item || typeof item !== "object") continue;
      for (const [k, v] of Object.entries(item)) {
        if (k === "jaulas") continue;
        if (typeof v !== "string") continue;
        fields.push({ key: k, clarification: v });
      }
    }
    return { countryKey, label: bundle.label, fields };
  }
  return null;
}
