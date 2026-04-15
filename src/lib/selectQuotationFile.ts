export type QuotationPickFile = {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
};

const SHEETS_MIME = "application/vnd.google-apps.spreadsheet";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";

function isQuotationSpreadsheet(file: QuotationPickFile): boolean {
  const mime = (file.mimeType ?? "").toLowerCase();
  const name = file.name.toLowerCase();

  if (mime === SHEETS_MIME || mime === XLSX_MIME || mime === XLS_MIME) {
    return true;
  }

  return name.endsWith(".xlsx") || name.endsWith(".xls");
}

function scoreFile(file: QuotationPickFile): number {
  const mime = (file.mimeType ?? "").toLowerCase();
  const name = file.name.toLowerCase();

  if (mime === XLSX_MIME || name.endsWith(".xlsx")) return 4;
  if (mime === XLS_MIME || name.endsWith(".xls")) return 3;
  if (mime === SHEETS_MIME) return 2;
  return 0;
}

function modifiedAt(file: QuotationPickFile): number {
  const t = Date.parse(file.modifiedTime ?? "");
  return Number.isFinite(t) ? t : 0;
}

export function selectQuotationFile(
  files: QuotationPickFile[],
): QuotationPickFile | null {
  const candidates = files.filter(isQuotationSpreadsheet);
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    const scoreDiff = scoreFile(b) - scoreFile(a);
    if (scoreDiff !== 0) return scoreDiff;

    const modifiedDiff = modifiedAt(b) - modifiedAt(a);
    if (modifiedDiff !== 0) return modifiedDiff;

    return a.name.localeCompare(b.name);
  });

  return sorted[0] ?? null;
}
