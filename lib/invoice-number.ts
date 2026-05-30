import type { StudentBillingRow } from "@/lib/types";

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

export function buildInvoiceNumber(
  yearMonth: string,
  index: number,
): string {
  return `KOM-${yearMonth}-${String(index + 1).padStart(4, "0")}`;
}

export function buildPaymentReference(
  studentName: string,
  yearMonth: string,
): string {
  return `KOM-${slugifyName(studentName).toUpperCase()}-${yearMonth}`;
}

export function invoiceIndexForRow(
  rows: StudentBillingRow[],
  rowId: string,
): number {
  const idx = rows.findIndex((r) => r.id === rowId);
  return idx >= 0 ? idx : 0;
}
