import { isBlueBackground, isYellowBackground, toRgb } from "@/lib/sheets/colors";
import type { Rgb, SessionCellType } from "@/lib/types";

export type ClassifiedCell = {
  billable: boolean;
  cellType: SessionCellType;
  makeupNote?: string;
};

export function classifyAttendanceCell(
  value: string,
  background: Rgb | null,
): ClassifiedCell {
  const v = value.trim();
  if (!v) return { billable: false, cellType: "empty" };
  if (/^waive$/i.test(v)) return { billable: false, cellType: "waive" };
  if (/free\s*trial/i.test(v)) return { billable: false, cellType: "trial" };
  if (isBlueBackground(background)) return { billable: false, cellType: "trial" };
  if (v === "1") return { billable: true, cellType: "attended" };
  // MU / M/U on … = billable session (colour is for your tracking only)
  if (/M\/?U\s*on\s*/i.test(v)) {
    const scheduled = isYellowBackground(background);
    return {
      billable: true,
      cellType: scheduled ? "makeup_scheduled" : "makeup_done",
      makeupNote: v,
    };
  }
  if (/^MU$/i.test(v)) {
    return { billable: true, cellType: "makeup_done", makeupNote: v };
  }
  return { billable: false, cellType: "other" };
}

export function extractBackground(
  effectiveFormat:
    | { backgroundColor?: { red?: number; green?: number; blue?: number } }
    | null
    | undefined,
): Rgb | null {
  return toRgb(effectiveFormat?.backgroundColor ?? null);
}
