import raw from "@/data/latam_profit_transport_by_country.json";

type CountryBundle = {
  label: string;
  items: Record<string, string>[];
  notes?: string[];
};

type Root = { countries: Record<string, CountryBundle> };

function isStringRecordArray(value: unknown): value is Record<string, string>[] {
  if (!Array.isArray(value)) return false;
  return value.every((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    return Object.values(entry).every((v) => typeof v === "string");
  });
}

function parseRoot(value: unknown): Root {
  if (typeof value !== "object" || value === null) {
    return { countries: {} };
  }

  const countriesValue = (value as { countries?: unknown }).countries;
  if (typeof countriesValue !== "object" || countriesValue === null) {
    return { countries: {} };
  }

  const countries: Record<string, CountryBundle> = {};

  for (const [countryKey, bundle] of Object.entries(countriesValue)) {
    if (typeof bundle !== "object" || bundle === null) continue;

    const label =
      typeof (bundle as { label?: unknown }).label === "string"
        ? (bundle as { label: string }).label
        : countryKey;

    const items = isStringRecordArray((bundle as { items?: unknown }).items)
      ? (bundle as { items: Record<string, string>[] }).items
      : [];

    const notesRaw = (bundle as { notes?: unknown }).notes;
    const notes =
      Array.isArray(notesRaw) && notesRaw.every((note) => typeof note === "string")
        ? notesRaw
        : undefined;

    countries[countryKey] = { label, items, notes };
  }

  return { countries };
}

const root = parseRoot(raw as unknown);

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
