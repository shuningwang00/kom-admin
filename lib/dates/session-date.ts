/** Normalize DB/API session dates to YYYY-MM-DD for comparisons. */
export function sessionIsoDate(value: string | Date): string {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = value.getUTCMonth() + 1;
    const d = value.getUTCDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return trimmed;
}
