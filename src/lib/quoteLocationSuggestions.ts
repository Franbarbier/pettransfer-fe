/** Respuesta de `/quotes/suggest/origins` y `/quotes/suggest/destinations` (destinos globales, sin filtrar por origen). */
export type LocationSuggestOption = {
  /** Valor en DB (`origin` / `destination`) para búsquedas y filtros. */
  value: string;
  /** Texto mostrado (p. ej. `formatted_*`). */
  label: string;
};

/**
 * Parsea lista de sugerencias: objetos `{ value, label }` o strings legacy.
 */
export function parseLocationSuggestList(items: unknown): LocationSuggestOption[] {
  if (!Array.isArray(items)) return [];
  const out: LocationSuggestOption[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      out.push({ value: item, label: item });
      continue;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      if (typeof o.value !== "string" || o.value.length === 0) continue;
      const label =
        typeof o.label === "string" && o.label.length > 0 ? o.label : o.value;
      out.push({ value: o.value, label });
    }
  }
  return out;
}
