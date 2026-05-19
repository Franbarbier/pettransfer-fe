function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

const OCEANIA_COUNTRIES = [
  "australia",
  "new zealand", "nueva zelanda", "nueva zelandia",
  "fiji", "fiyi",
  "papua new guinea", "papua nueva guinea",
  "samoa",
  "tonga",
  "vanuatu",
  "solomon islands", "islas salomon",
  "new caledonia", "nueva caledonia",
  "french polynesia", "polinesia francesa",
  "kiribati",
  "micronesia",
  "palau", "palaos",
  "marshall islands", "islas marshall",
  "nauru",
  "tuvalu",
];

const SOUTH_AFRICA_NAMES = ["south africa", "sudafrica", "sudáfrica"];

const PANAMA_NAMES = ["panama", "panamá"];

// Destinos LATAM (sin Argentina, que es el origen típico) + Norteamérica + UE.
// Lista usada por la condición de "Certificado internacional de salud" para
// EXPO desde Argentina.
const LATAM_NON_ARG = [
  "bolivia",
  "brasil", "brazil",
  "chile",
  "colombia",
  "ecuador",
  "guatemala",
  "mexico", "méxico",
  "panama", "panamá",
  "paraguay",
  "peru", "perú",
  "uruguay",
  "venezuela",
  "costa rica",
];

const NORTH_AMERICA = [
  "usa", "estados unidos", "united states", "u.s.a", "us",
  "canada", "canadá",
  "puerto rico",
];

const EU_COUNTRIES = [
  "union europea", "unión europea", "european union", "ue",
  "austria",
  "belgica", "bélgica", "belgium",
  "bulgaria",
  "croacia", "croatia",
  "chipre", "cyprus",
  "republica checa", "república checa", "czech republic", "chequia",
  "dinamarca", "denmark",
  "estonia",
  "finlandia", "finland",
  "francia", "france",
  "alemania", "germany",
  "grecia", "greece",
  "hungria", "hungría", "hungary",
  "irlanda", "ireland",
  "italia", "italy",
  "letonia", "latvia",
  "lituania", "lithuania",
  "luxemburgo", "luxembourg",
  "malta",
  "paises bajos", "países bajos", "holanda", "netherlands",
  "polonia", "poland",
  "portugal",
  "rumania", "romania",
  "eslovaquia", "slovakia",
  "eslovenia", "slovenia",
  "españa", "espana", "spain",
  "suecia", "sweden",
];

export function destIsOceania(destination: string): boolean {
  const d = norm(destination);
  if (!d) return false;
  return OCEANIA_COUNTRIES.some((c) => d.includes(c));
}

export function destIsSouthAfrica(destination: string): boolean {
  const d = norm(destination);
  if (!d) return false;
  return SOUTH_AFRICA_NAMES.some((c) => d.includes(c));
}

export function destIsPanama(destination: string): boolean {
  const d = norm(destination);
  if (!d) return false;
  return PANAMA_NAMES.some((c) => d.includes(c));
}

export function destIsLatamNonArgUsaCanadaEU(destination: string): boolean {
  const d = norm(destination);
  if (!d) return false;
  return (
    LATAM_NON_ARG.some((c) => d.includes(c)) ||
    NORTH_AMERICA.some((c) => d.includes(c)) ||
    EU_COUNTRIES.some((c) => d.includes(c))
  );
}

export function originIs(origin: string, country: string): boolean {
  const o = norm(origin);
  const c = norm(country);
  return !!o && !!c && o.includes(c);
}
