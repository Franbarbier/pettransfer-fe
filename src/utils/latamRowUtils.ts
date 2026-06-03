import type { LatamFieldRow } from "@/types/quote";

export function newLatamRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `latam-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function truncateForOption(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Clases de color para distinguir ítems del presupuesto según su origen.
 * - `impo`    → sky (celeste)
 * - `json`    → violet (violeta)
 * - `crate`   → amber
 * - `transito`→ emerald
 * - `custom` / `similar` → gris neutro
 */
export function latamRowThemeClasses(source: LatamFieldRow["source"]): string {
  switch (source) {
    case "crate":
      return "border-amber-200 bg-amber-50/70 ring-amber-100/80";
    case "impo":
      return "border-sky-200 bg-sky-50/70 ring-sky-100/80";
    case "json":
      return "border-violet-200 bg-violet-50/70 ring-violet-100/80";
    case "transito":
      return "border-emerald-200 bg-emerald-50/70 ring-emerald-100/80";
    case "similar":
    case "custom":
    default:
      return "border-zinc-200/90 bg-zinc-50/40 ring-zinc-100/80";
  }
}
