export const DROPBOX_YA_COTIZADOS_PATH = "/Cotizaciones/A cotizar y cotizados/Ya Cotizados";
export const DROPBOX_PEDIDOS_PARA_COTIZAR_PATH = "/Cotizaciones/A cotizar y cotizados/Pedidos para cotizar";

export type YaCotizadosSearchParams = {
  customerName: string;
  operation: string; // "impo" | "expo" | "ambas" | "transito"
  origin: string;
  destination: string;
};

export type FolderMatch = {
  name: string;
  pathDisplay: string | null;
};

export type YaCotizadosSearchResult = {
  matches: FolderMatch[];
  scanned: number;
};

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/** Extrae tokens buscables de un string de ubicación (ciudad, IATA, país). */
function locationTokens(location: string): string[] {
  const iata = location.match(/\(([A-Z]{3})\)/)?.[1] ?? location.match(/\b([A-Z]{3})\b/)?.[1];
  const words = location
    .replace(/[()[\]]/g, " ")
    .split(/[\s,\-–]+/)
    .map((w) => normalize(w))
    .filter((w) => w.length >= 3);
  const tokens = new Set(words);
  if (iata) tokens.add(normalize(iata));
  return [...tokens];
}

export function folderMatchesYaCotizados(
  folderName: string,
  params: YaCotizadosSearchParams,
): boolean {
  const name = normalize(folderName);

  // Customer name: todas las palabras deben estar presentes
  const customerWords = normalize(params.customerName).split(/\s+/).filter(Boolean);
  if (customerWords.length > 0 && customerWords.some((w) => !name.includes(w))) return false;

  // Operación: para "ambas", deben aparecer impo Y expo
  if (params.operation) {
    const opTerms = params.operation === "ambas" ? ["impo", "expo"] : [normalize(params.operation)];
    const check = params.operation === "ambas"
      ? opTerms.every((op) => name.includes(op))
      : opTerms.some((op) => name.includes(op));
    if (!check) return false;
  }

  // Origen: al menos un token debe estar en el nombre de la carpeta
  if (params.origin) {
    const tokens = locationTokens(params.origin);
    if (tokens.length > 0 && !tokens.some((t) => name.includes(t))) return false;
  }

  // Destino: al menos un token debe estar en el nombre de la carpeta
  if (params.destination) {
    const tokens = locationTokens(params.destination);
    if (tokens.length > 0 && !tokens.some((t) => name.includes(t))) return false;
  }

  return true;
}

export async function searchYaCotizados(
  params: YaCotizadosSearchParams,
  folderPath: string = DROPBOX_YA_COTIZADOS_PATH,
): Promise<YaCotizadosSearchResult> {
  console.log("[Dropbox] Buscando con parámetros:", {
    customerName: params.customerName,
    operation: params.operation,
    origin: params.origin,
    destination: params.destination,
    folderPath,
  });

  const res = await fetch("/api/dropbox/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderPath }),
  });

  const data = (await res.json()) as {
    ok: boolean;
    entries?: Array<{ tag: string; name: string; pathDisplay: string | null }>;
    error?: string;
  };

  if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

  const folders = (data.entries ?? []).filter((e) => e.tag === "folder");
  console.log("[Ya Cotizados] Carpetas en Dropbox:", folders.map((f) => f.name));
  const matches = folders
    .filter((e) => folderMatchesYaCotizados(e.name, params))
    .map((e) => ({ name: e.name, pathDisplay: e.pathDisplay }));

  return { matches, scanned: folders.length };
}
