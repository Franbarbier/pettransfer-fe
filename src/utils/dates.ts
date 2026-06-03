const SPANISH_MONTHS_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Devuelve la fecha local de hoy en formato YYYY-MM-DD para `<input type="date">`. */
export function todayLocalIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Formatea una fecha YYYY-MM-DD como "Mes Día, Año" en español
 * (ej. "Agosto 16, 2026"). Si la fecha es inválida o vacía devuelve "".
 */
export function formatIsoDateAsSpanishLong(iso: string): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!month || month < 1 || month > 12) return "";
  if (!day || day < 1 || day > 31) return "";
  return `${SPANISH_MONTHS_LONG[month - 1]} ${day}, ${year}`;
}
