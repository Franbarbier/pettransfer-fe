export const LATAM_COVERED_COUNTRIES = new Set([
  "argentina", "brazil", "brasil", "mexico", "méxico",
  "costa rica", "paraguay", "uruguay", "bolivia",
  "chile", "colombia", "ecuador",
]);

export function parseLoc(loc: string): { city: string; country: string } {
  const parts = loc.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      city: parts.slice(0, parts.length - 1).join(", "),
      country: parts[parts.length - 1],
    };
  }
  return { city: "", country: parts[0] ?? "" };
}

export function isDestinationCoveredByLatam(country: string): boolean {
  return LATAM_COVERED_COUNTRIES.has(country.toLowerCase().trim());
}

export function normalizePaisDestino(
  country: string,
): "argentina" | "mexico" | "otro" {
  const lower = country.toLowerCase().trim();
  if (lower === "argentina") return "argentina";
  if (lower === "mexico" || lower === "méxico") return "mexico";
  return "otro";
}
