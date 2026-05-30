import {
  classifyAttendanceCell,
  extractBackground,
} from "@/lib/sheets/cell-rules";
import { cellText, type GridCell } from "@/lib/sheets/row-utils";

export const REGISTRATION_FEE_AMOUNT = 40;
export const REGISTRATION_FEE_DESCRIPTION = "Registration and Material Fee";

/** Free trial in an earlier date column, then a billable lesson later in the month. */
export function isRegistrationFeeDue(
  values: GridCell[],
  dateColumns: Array<{ colIndex: number; label: string }>,
): boolean {
  let hadTrial = false;

  for (const { colIndex } of dateColumns) {
    const cell = values[colIndex];
    const value = cellText(cell);
    if (!value) continue;

    const classified = classifyAttendanceCell(
      value,
      extractBackground(cell?.effectiveFormat),
    );

    if (classified.cellType === "trial") {
      hadTrial = true;
      continue;
    }

    if (classified.billable && hadTrial) {
      return true;
    }
  }

  return false;
}
