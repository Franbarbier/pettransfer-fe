export type ArgExpoPrecioRow = {
  id: number;
  destino: string;
  region: string;
  cantidad_mascotas: number;
  precio_usd: string;
  notas: string | null;
};

// Canonical destino names used in the DB
const EU_DESTINO = "UNION EUROPEA";
const USA_DESTINO = "USA / CANADA / PUERTO RICO";

const EU_NAMES = [
  "union europea", "unión europea", "european union", "ue",
  "austria", "belgica", "bélgica", "belgium", "bulgaria",
  "croacia", "croatia", "chipre", "cyprus",
  "republica checa", "república checa", "czech republic", "chequia",
  "dinamarca", "denmark", "estonia",
  "finlandia", "finland", "francia", "france",
  "alemania", "germany", "grecia", "greece",
  "hungria", "hungría", "hungary", "irlanda", "ireland",
  "italia", "italy", "letonia", "latvia",
  "lituania", "lithuania", "luxemburgo", "luxembourg",
  "malta", "paises bajos", "países bajos", "holanda", "netherlands",
  "polonia", "poland", "portugal",
  "rumania", "romania", "eslovaquia", "slovakia",
  "eslovenia", "slovenia", "españa", "espana", "spain",
  "suecia", "sweden",
];

const USA_NAMES = [
  "usa", "estados unidos", "united states", "u.s.a", "us",
  "canada", "canadá",
  "puerto rico",
];

function norm(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

function normalizeDestino(destination: string): string | null {
  const d = norm(destination);
  if (!d) return null;
  if (EU_NAMES.some((n) => d.includes(n))) return EU_DESTINO;
  if (USA_NAMES.some((n) => d.includes(n))) return USA_DESTINO;

  // Exact-ish match against known LATAM destinos
  const LATAM_MAP: Record<string, string> = {
    bolivia: "BOLIVIA",
    brasil: "BRASIL", brazil: "BRASIL",
    chile: "CHILE",
    colombia: "COLOMBIA",
    "costa rica": "COSTA RICA",
    ecuador: "ECUADOR",
    guatemala: "GUATEMALA",
    mexico: "MEXICO", "méxico": "MEXICO",
    panama: "PANAMA", "panamá": "PANAMA",
    paraguay: "PARAGUAY",
    peru: "PERU", "perú": "PERU",
    uruguay: "URUGUAY",
    venezuela: "VENEZUELA",
  };

  for (const [key, canonical] of Object.entries(LATAM_MAP)) {
    if (d.includes(key)) return canonical;
  }
  return null;
}

/**
 * Returns the matching row for a given destination and pet count.
 * If petCount exceeds the max available for that destination, uses the max row.
 */
export function lookupArgExpoRow(
  destination: string,
  petCount: number,
  rows: ArgExpoPrecioRow[],
): ArgExpoPrecioRow | null {
  const destino = normalizeDestino(destination);
  if (!destino) return null;

  const destRows = rows.filter((r) => r.destino === destino);
  if (destRows.length === 0) return null;

  const maxCount = Math.max(...destRows.map((r) => r.cantidad_mascotas));
  const effectiveCount = Math.min(Math.max(1, petCount), maxCount);

  return (
    destRows.find((r) => r.cantidad_mascotas === effectiveCount) ??
    destRows.sort((a, b) => b.cantidad_mascotas - a.cantidad_mascotas)[0]
  );
}
