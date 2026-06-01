import type { CalendarSessionStatus } from "@/lib/calendar/month-data";

/** Relief cover — burgundy tint (legend + session chips). */
export const calendarReliefLegendSwatchClass =
  "h-3 w-3 rounded border border-[#9a3d58] bg-[#edd4de]";

const reliefChipClass =
  "bg-[#edd4de] text-[#5c1832] border border-[#9a3d58]";
const reliefCardClass =
  "border-[#9a3d58] bg-[#edd4de]/90 text-[#5c1832]";

/** Compact chip in month grid / list view. */
export function calendarSessionChipClass(
  status: CalendarSessionStatus,
): string {
  switch (status) {
    case "red":
      return "bg-red-100 text-red-800 border border-red-300";
    case "blue":
      return "bg-sky-100 text-sky-800 border border-sky-300";
    case "grey":
      return "bg-zinc-400 text-white border border-zinc-500";
    case "inactive":
      return "bg-zinc-100 text-zinc-400 border border-zinc-200";
    case "relief":
      return reliefChipClass;
    case "cancelled":
      return "bg-zinc-200 text-zinc-600 border border-zinc-400 line-through decoration-zinc-500";
    default:
      return "bg-orange-50 text-orange-900 border border-orange-200";
  }
}

/** Larger session card in week view and admin day panel. */
export function calendarSessionCardClass(
  status: CalendarSessionStatus,
): string {
  switch (status) {
    case "red":
      return "border-red-300 bg-red-50 text-red-900";
    case "blue":
      return "border-sky-300 bg-sky-50 text-sky-900";
    case "grey":
      return "border-zinc-400 bg-zinc-300 text-zinc-700";
    case "inactive":
      return "border-zinc-200 bg-zinc-50 text-zinc-400";
    case "relief":
      return reliefCardClass;
    case "cancelled":
      return "border-zinc-400 bg-zinc-200/80 text-zinc-600 line-through decoration-zinc-500";
    default:
      return "border-orange-200 bg-orange-50/60 text-orange-900";
  }
}
