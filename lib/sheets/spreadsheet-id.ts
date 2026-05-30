/** Accept a raw ID or full Google Sheets URL. */
export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (!trimmed.includes("google.com") && !trimmed.includes("/")) {
    return trimmed;
  }

  try {
    const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match?.[1]) return match[1];
  } catch {
    // fall through
  }

  const fallback = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fallback?.[1]) return fallback[1];

  return null;
}
