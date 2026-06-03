import type { QuoteItemJson, QuoteRow, VendedorOption } from "@/types/quote";

export const QUOTE_FOOTER_TRIGGER = "conditions of contract";

export function formatVendedorDisclaimer(v: VendedorOption): string {
  return `${v.name} — ${v.email}`;
}

export function quoteAnimalsDisplay(q: QuoteRow): string {
  const desc = q.animals_description?.trim();
  if (desc) return desc;
  const raw = q.animals_raw?.trim();
  if (raw) return raw;
  const n = q.animals_count;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) {
    return n === 1 ? "1 animal" : `${n} animales`;
  }
  return "—";
}

/** Suma todos los enteros que aparecen en el texto (ej. "1 perro y 1 gato" → 2). */
export function sumDigitsInText(text: string): number {
  const matches = text.match(/\d+/g);
  if (!matches) return 0;
  return matches.reduce((acc, s) => acc + parseInt(s, 10), 0);
}

export function containsQuoteFooterTrigger(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(QUOTE_FOOTER_TRIGGER);
}

/**
 * Recorta el array de ítems (ya ordenado por `display_order`) en cuanto aparece
 * el texto del footer.
 */
export function stripQuoteItemsAfterFooter(
  items: QuoteItemJson[] | undefined | null,
): QuoteItemJson[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.display_order - b.display_order);
  const result: QuoteItemJson[] = [];
  for (const it of sorted) {
    if (
      containsQuoteFooterTrigger(it.item_name_raw) ||
      containsQuoteFooterTrigger(it.item_display_name) ||
      containsQuoteFooterTrigger(it.inline_note)
    ) {
      return result;
    }
    const detailsSorted = [...(it.details ?? [])].sort(
      (a, b) => a.detail_order - b.detail_order,
    );
    const cutIdx = detailsSorted.findIndex((d) =>
      containsQuoteFooterTrigger(d.detail_text),
    );
    if (cutIdx === -1) {
      result.push(it);
      continue;
    }
    result.push({ ...it, details: detailsSorted.slice(0, cutIdx) });
    return result;
  }
  return result;
}

export function stripFooterFromQuotes(quotes: QuoteRow[]): QuoteRow[] {
  return quotes.map((q) => ({
    ...q,
    items: stripQuoteItemsAfterFooter(q.items),
  }));
}

/** Suma importes tipo "270", "270 USD", "1.234,56" (aprox.). */
export function parseBudgetAmount(s: string): number | null {
  const t = s.trim();
  if (!t || t === "—") return null;
  const noSpace = t.replace(/\s/g, "");
  const commaDecimal =
    /^-?[\d.]+,\d{1,2}$/.test(noSpace) && noSpace.includes(",")
      ? noSpace.replace(/\./g, "").replace(",", ".")
      : noSpace.replace(/,/g, "");
  const match = commaDecimal.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) ? n : null;
}

/** Extrae código IATA (3 letras mayúsculas) de un campo de texto. Si no encuentra, devuelve el texto completo. */
export function extractIataCode(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const paren = t.match(/\(([A-Z]{3})\)/);
  if (paren) return paren[1];
  const word = t.match(/\b([A-Z]{3})\b/);
  if (word) return word[1];
  return t;
}

export function resolvePlaceholders(text: string, ctx: {
  origen: string;
  destino: string;
  codigoAeropuerto: string;
  codigoOrigen: string;
  codigoDestino: string;
  cantidadJaulas: string;
  tamano: string;
  tamanoJaulas: string;
  petsDesc: string;
  aerolinea: string;
}): string {
  return text
    .replace(/\[ORIGEN\]/g, ctx.origen || "[ORIGEN]")
    .replace(/\[destino\]/g, ctx.destino || "[destino]")
    .replace(/\[código aeropuerto\]/g, ctx.codigoAeropuerto)
    .replace(/\[codigo origen\]/g, ctx.codigoOrigen)
    .replace(/\[codigo destino\]/g, ctx.codigoDestino)
    .replace(/\[cantidad de jaulas\]/g, ctx.cantidadJaulas || "[cantidad de jaulas]")
    .replace(/\[tamaño\]/g, ctx.tamano || "[tamaño]")
    .replace(/\[tamaño de jaulas\]/g, ctx.tamanoJaulas || "[tamaño de jaulas]")
    .replace(/\[cantidad y tipo de mascotas\]/g, ctx.petsDesc || "[cantidad y tipo de mascotas]")
    .replace(/\[aerolinea\]/g, ctx.aerolinea || "[aerolinea]");
}
