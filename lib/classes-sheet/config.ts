export const DEFAULT_CLASSES_SPREADSHEET_ID =
  "13vJjI7fJS41eANI-2iROEXJS4BIIC6kBfoHNY0a258A";

export function getClassesSpreadsheetId(): string {
  return (
    process.env.CLASSES_SPREADSHEET_ID?.trim() || DEFAULT_CLASSES_SPREADSHEET_ID
  );
}

export function getClassesSheetRange(): string {
  return process.env.CLASSES_SHEET_RANGE?.trim() || "A1:Z500";
}

/** How long before we hit Google again (default 24h — schedule rarely changes). */
export function getClassesCacheSeconds(): number {
  const raw = Number(process.env.CLASSES_CACHE_SECONDS ?? "86400");
  return Number.isFinite(raw) && raw >= 60 ? raw : 86400;
}
