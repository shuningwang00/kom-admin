import { resolveRatePerSession } from "@/lib/billing/rates";
import type { StudentBillingRow } from "@/lib/types";

export type InvoiceTotals = {
  subtotal: number;
  discount: number;
  total: number;
};

/** Standard-rate subtotal vs amount charged (sheet override / manual discount). */
export function computeInvoiceTotals(
  row: StudentBillingRow,
  allRows: StudentBillingRow[],
): InvoiceTotals {
  const { rate: standardRate } = resolveRatePerSession(row, allRows);
  const registrationFee = row.registrationFee ?? 0;
  const tuitionSubtotal =
    Math.round(row.sessionCount * standardRate * 100) / 100;
  const subtotal =
    Math.round((tuitionSubtotal + registrationFee) * 100) / 100;
  const total = row.computedAmount;
  const tuitionCharged = Math.round((total - registrationFee) * 100) / 100;
  const discount = Math.max(
    0,
    Math.round((tuitionSubtotal - tuitionCharged) * 100) / 100,
  );

  return { subtotal, discount, total };
}
