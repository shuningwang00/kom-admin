import { sessionIsoDate } from "@/lib/dates/session-date";

/** ISO date (YYYY-MM-DD) → DD-MM-YYYY for tables and labels. */
export function formatDisplayDate(
  value: string | null | undefined,
  fallback = "—",
): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  const norm = sessionIsoDate(trimmed);
  const match = norm.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return trimmed;

  const [, year, month, day] = match;
  return `${day}-${month}-${year}`;
}
