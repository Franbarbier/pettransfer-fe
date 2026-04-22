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
 * Deja solo el número (con coma o punto como decimal) de un texto que puede
 * venir con símbolos de moneda (ej. "USD 270", "$ 140", "270 USD"). Si no
 * encuentra un número válido devuelve cadena vacía.
 */
function stripCurrencyFromCostText(raw: string): string {
  const match = raw.match(/-?\d+(?:[.,]\d+)?/);
  return match ? match[0] : "";
}

/**
 * Valor por defecto para el campo "Costo" al elegir una fila del JSON
 * (`crate_tariffs_by_country`) según el país inferido del origen.
 *
 * Devuelve solo el monto numérico; la moneda se muestra fuera (prefijo fijo
 * "USD" en el PDF), así que sacamos cualquier "USD"/"$" del template.
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
  if (c.cost_amount != null && Number.isFinite(c.cost_amount)) {
    return String(c.cost_amount);
  }
  if (c.cost_label != null && String(c.cost_label).trim() !== "") {
    const numeric = stripCurrencyFromCostText(String(c.cost_label));
    if (numeric) return numeric;
  }
  return "";
}

/**
 * Devuelve `true` si el `size_code` corresponde a una jaula tamaño "100" o
 * "200" (acepta variantes con sufijo, ej. "200 (Larga)").
 */
export function isCatCrateSize(sizeCode: string | null | undefined): boolean {
  if (!sizeCode) return false;
  return /^(100|200)\b/.test(String(sizeCode).trim());
}

/**
 * Filtra opciones de jaula según el tipo de mascota.
 * - "gato": solo tamaños 100 y 200.
 * - resto: sin filtrar.
 */
export function filterCrateOptionsForPet(
  opts: CrateTariffOption[],
  tipo: "perro" | "gato" | "",
): CrateTariffOption[] {
  if (tipo === "gato") return opts.filter((o) => isCatCrateSize(o.size_code));
  return opts;
}

/**
 * Para una mascota tipo "gato", elige el `id` por defecto: prioriza el primer
 * tamaño "200"; si no existe, usa el primer "100"; si tampoco, devuelve "".
 */
export function defaultCrateIdForCat(opts: CrateTariffOption[]): string {
  const cats = opts.filter((o) => isCatCrateSize(o.size_code));
  const c200 = cats.find((o) => /^200\b/.test(String(o.size_code).trim()));
  if (c200) return c200.id;
  const c100 = cats.find((o) => /^100\b/.test(String(o.size_code).trim()));
  if (c100) return c100.id;
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
