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
 * Claves del JSON que se consideran "de jaula" y se muestran como notas o
 * sub-ítems dentro del bloque de crate de cada mascota (no dentro de la guía
 * EXPO). Usamos esta lista tanto para excluir esas claves del panel EXPO como
 * para detectar cuáles son "del crate".
 */
const JAULA_RELATED_KEYS = ["jaulas", "pre_entrega_de_la_jaula"] as const;

function isJaulaRelatedKey(key: string): boolean {
  return (JAULA_RELATED_KEYS as readonly string[]).includes(key);
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

/**
 * Si el origen coincide con algún `countries.*.label`, devuelve el texto de
 * la entrada `pre_entrega_de_la_jaula` de ese país. Se muestra como sub-ítem
 * dentro del bloque de crate (no en la guía EXPO) y se puede agregar al
 * presupuesto con un botón.
 */
export function findPreEntregaJaulaNoteForOrigin(
  originRaw: string,
): { countryKey: string; label: string; note: string } | null {
  const origin = originRaw.trim();
  if (!origin) return null;

  for (const [countryKey, bundle] of Object.entries(root.countries)) {
    if (!originMatchesLabel(origin, bundle.label)) continue;
    for (const item of bundle.items) {
      const v = item?.pre_entrega_de_la_jaula;
      if (typeof v === "string" && v.length > 0) {
        return { countryKey, label: bundle.label, note: v };
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
 * Omite las claves relacionadas a jaula (`jaulas` y `pre_entrega_de_la_jaula`)
 * porque se muestran aparte dentro del bloque de crate de cada mascota.
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
        if (isJaulaRelatedKey(k)) continue;
        if (typeof v !== "string") continue;
        fields.push({ key: k, clarification: v });
      }
    }
    return { countryKey, label: bundle.label, fields };
  }
  return null;
}
