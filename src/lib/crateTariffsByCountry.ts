export type CrateTariffOption = {
  id: string;
  size_code: string;
  pet_scope: string;
  measures_cm: string | null;
  weight_vol_kg: string | null;
  /** Monto numérico si aplica; si solo hay texto en `notes`, puede ser null */
  cost_amount: number | null;
  cost_currency: "USD" | "ARS" | null;
  /** Texto de costo original (ej. "$ 140") */
  cost_label?: string | null;
  notes?: string | null;
};

export type CrateTariffsByCountryData = {
  countries: Record<string, CrateTariffOption[]>;
};

/** Países con tarifas de jaula en JSON. Orden: más específico primero. */
const COUNTRY_MATCH_ORDER: { key: string; labels: string[] }[] = [
  { key: "costa_rica", labels: ["costa rica", "costa_rica", "c rica"] },
  { key: "brasil", labels: ["brasil", "brazil", "são paulo", "sao paulo"] },
  { key: "argentina", labels: ["argentina", "buenos aires", "eze", "aep"] },
  { key: "chile", labels: ["chile", "santiago", "scl"] },
  { key: "colombia", labels: ["colombia", "bogotá", "bogota", "bog"] },
  { key: "ecuador", labels: ["ecuador", "quito", "gye"] },
  { key: "mexico", labels: ["mexico", "méxico", "cdmx", "ciudad de mexico"] },
];

function normalizeLoose(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function originMatchesAnyLabel(origin: string, labels: string[]): boolean {
  const o = normalizeLoose(origin);
  if (!o) return false;
  for (const lab of labels) {
    const b = normalizeLoose(lab);
    if (!b) continue;
    if (o === b) return true;
    if (o.includes(b) || b.includes(o)) return true;
  }
  return false;
}

export function resolveCrateCountryKey(originRaw: string): string | null {
  const origin = originRaw.trim();
  if (!origin) return null;
  for (const { key, labels } of COUNTRY_MATCH_ORDER) {
    if (originMatchesAnyLabel(origin, [...labels, key.replace(/_/g, " ")])) {
      return key;
    }
  }
  return null;
}

export function getCrateOptionsForOrigin(
  data: CrateTariffsByCountryData | null,
  originRaw: string,
): CrateTariffOption[] {
  if (!data?.countries) return [];
  const key = resolveCrateCountryKey(originRaw);
  if (!key) return [];
  const list = data.countries[key];
  return Array.isArray(list) ? list : [];
}

/**
 * Valor por defecto para el campo "Costo" al elegir una fila del JSON
 * (`crate_tariffs_by_country`) según el país inferido del origen.
 */
export function defaultCostoFromCrateSelection(
  data: CrateTariffsByCountryData | null,
  originRaw: string,
  crateId: string,
): string {
  if (!crateId.trim()) return "";
  const opts = getCrateOptionsForOrigin(data, originRaw);
  const c = opts.find((o) => o.id === crateId);
  if (!c) return "";
  if (c.cost_label != null && String(c.cost_label).trim() !== "") {
    return String(c.cost_label).trim();
  }
  if (c.cost_amount != null) {
    const cur = c.cost_currency === "ARS" ? "ARS" : "USD";
    return `${cur} ${c.cost_amount}`;
  }
  return "";
}

export function formatCrateOptionLabel(c: CrateTariffOption): string {
  const parts = [
    c.size_code,
    c.pet_scope,
    c.measures_cm ? `${c.measures_cm} cm` : null,
    c.weight_vol_kg ? `vol. ${c.weight_vol_kg} kg` : null,
  ].filter(Boolean);
  const left = parts.join(" · ");
  const cost =
    c.cost_label ??
    (c.cost_amount != null
      ? `${c.cost_currency === "USD" || !c.cost_currency ? "USD" : c.cost_currency} ${c.cost_amount}`
      : null);
  const main = cost ? `${left} — ${cost}` : left;
  return c.notes ? `${main} (${c.notes})` : main;
}
