import { isBlackBackground, toRgb } from "@/lib/sheets/colors";
import {
  CLASS_TIME_PATTERN,
  looksLikeClassHeader,
} from "@/lib/sheets/parse-class-header";

type CellValueEntry = {
  stringValue?: string | null;
  boolValue?: boolean | null;
  numberValue?: number | null;
};

export type GridCell = {
  formattedValue?: string | null;
  userEnteredValue?: CellValueEntry | null;
  effectiveValue?: CellValueEntry | null;
  effectiveFormat?: {
    backgroundColor?: { red?: number; green?: number; blue?: number };
  } | null;
} | null;

function textFromEntry(entry?: CellValueEntry | null): string {
  if (!entry) return "";
  if (entry.stringValue != null && entry.stringValue !== "") {
    return String(entry.stringValue).trim();
  }
  if (entry.boolValue === true) return "TRUE";
  if (entry.numberValue != null && entry.numberValue !== 0) {
    return String(entry.numberValue).trim();
  }
  return "";
}

/** Prefer user-entered value (dropdowns/checkboxes), then formatted display text. */
export function cellText(cell: GridCell): string {
  if (!cell) return "";
  const entered = textFromEntry(cell.userEnteredValue);
  if (entered) return entered;
  const formatted = (cell.formattedValue ?? "").trim();
  if (formatted) return formatted;
  return textFromEntry(cell.effectiveValue);
}

/** Normalise Payment column values for status badges. */
export function normalizePaymentStatus(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^paid$/i.test(t)) return "Paid";
  if (t.toUpperCase() === "TRUE") return "Paid";
  return t;
}

const SKIP_CELL =
  /^(name|inv|contact|school|payment|amount|receipt|paid|remarks)$/i;

/** Text from class header row — only cols before dates/payment. */
export function getRowLabel(
  values: GridCell[],
  beforeCol = 8,
): string {
  const parts: string[] = [];
  for (let i = 0; i < Math.min(values.length, beforeCol); i++) {
    const t = cellText(values[i]);
    if (!t || SKIP_CELL.test(t)) continue;
    if (/^\d{1,2}\/\d{1,2}$/.test(t)) continue;
    if (/^\$[\d,.]+$/.test(t)) continue;
    if (/^paid$/i.test(t)) continue;
    parts.push(t);
  }
  return parts.join(" ").trim();
}

export function rowHasDarkBackground(
  values: GridCell[],
  maxCols = 12,
): boolean {
  for (let i = 0; i < Math.min(values.length, maxCols); i++) {
    const rgb = toRgb(values[i]?.effectiveFormat?.backgroundColor ?? null);
    if (isBlackBackground(rgb)) return true;
    if (rgb && rgb.red < 0.45 && rgb.green < 0.45 && rgb.blue < 0.45) {
      return true;
    }
  }
  return false;
}

export function isClassHeaderRow(
  values: GridCell[],
  beforeCol = 8,
): boolean {
  const label = getRowLabel(values, beforeCol);
  if (!label) return false;
  if (/^name$/i.test(label)) return false;

  const hasTime = CLASS_TIME_PATTERN.test(label);
  const hasLevel = /(?:Sec|Pri|JC|IP)\s*\d/i.test(label);

  if (looksLikeClassHeader(label) || (hasTime && hasLevel)) {
    return true;
  }

  if (rowHasDarkBackground(values, beforeCol) && (hasTime || hasLevel)) {
    return true;
  }

  return false;
}

export type ColumnHeader = {
  colMap: Record<string, number>;
  dateColumns: Array<{ colIndex: number; label: string }>;
};

const DATE_HEADER = /^\d{1,2}\/\d{1,2}$/;

export function detectColumnHeaderRow(
  values: GridCell[],
): ColumnHeader | null {
  const colMap: Record<string, number> = {};
  values.forEach((cell, i) => {
    const t = cellText(cell).toLowerCase();
    if (t === "name") colMap.name = i;
    if (t === "inv") colMap.inv = i;
    if (t === "contact") colMap.contact = i;
    if (t === "school") colMap.school = i;
    if (t === "payment") colMap.payment = i;
    if (t.includes("amount")) colMap.amount = i;
    if (t.includes("receipt")) colMap.receipt = i;
  });
  if (colMap.payment === undefined) {
    values.forEach((cell, i) => {
      const t = cellText(cell).toLowerCase();
      if (t === "paid" || t === "status") colMap.payment = i;
    });
  }
  if (colMap.name === undefined) return null;

  const dateColumns: Array<{ colIndex: number; label: string }> = [];
  values.forEach((cell, i) => {
    const label = cellText(cell);
    if (DATE_HEADER.test(label)) dateColumns.push({ colIndex: i, label });
  });
  if (dateColumns.length === 0) return null;

  return { colMap, dateColumns };
}

/**
 * Payment / Amount / INV / Receipt often sit on the black class row (row above Name).
 */
export function mergeTrailingColumnHeaders(
  colMap: Record<string, number>,
  values: GridCell[],
): void {
  values.forEach((cell, i) => {
    const t = cellText(cell).toLowerCase().trim();
    if (!t) return;
    if (
      colMap.payment === undefined &&
      (t === "payment" || t === "paid" || t === "status")
    ) {
      colMap.payment = i;
    }
    if (colMap.amount === undefined && t.includes("amount")) {
      colMap.amount = i;
    }
    if (colMap.receipt === undefined && t.includes("receipt")) {
      colMap.receipt = i;
    }
    if (colMap.inv === undefined && t === "inv") {
      colMap.inv = i;
    }
  });
}

/** Row above Name row: class banner with Payment / Amount headers, not a student row. */
export function isSupplementalHeaderRow(values: GridCell[]): boolean {
  const hasNameHeader = values.some(
    (cell) => cellText(cell).toLowerCase() === "name",
  );
  if (hasNameHeader) return false;

  return values.some((cell) => {
    const t = cellText(cell).toLowerCase().trim();
    return (
      t === "payment" ||
      t === "paid" ||
      t === "status" ||
      t.includes("amount") ||
      t.includes("receipt") ||
      t === "inv"
    );
  });
}

export function columnLetter(index: number): string {
  let n = index;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}
