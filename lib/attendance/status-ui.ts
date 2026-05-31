import type { AttendanceStatus } from "@/lib/attendance/status";

/** Short date for M/U scheduled label (from note or session date). */
export function makeupDateLabel(
  makeupNote: string,
  sessionDate?: string,
): string | null {
  const note = makeupNote.trim();
  const fromNote =
    note.match(/MU on\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i)?.[1] ??
    note.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/)?.[1];
  if (fromNote) return fromNote;

  if (sessionDate && /^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
    const parts = sessionDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (parts) return `${parts[3]}/${parts[2]}`;
  }

  return note || null;
}

export function statusDisplayLabel(
  status: AttendanceStatus,
  opts?: { makeupNote?: string; sessionDate?: string },
): string {
  const note = opts?.makeupNote ?? "";
  const sessionDate = opts?.sessionDate;

  switch (status) {
    case "present":
      return "Present";
    case "absent_pending":
      return "Absent";
    case "waive":
      return "Waive";
    case "pause":
      return "Pause";
    case "free_trial":
      return "Free trial";
    case "makeup_scheduled": {
      const date = makeupDateLabel(note, sessionDate);
      return date ? `M/U scheduled (${date})` : "M/U scheduled";
    }
    case "makeup_done":
      return "M/U completed";
    case "makeup_absent":
      return "Absent";
    default:
      return status;
  }
}

type StatusButtonStyle = { selected: string; idle: string };

export const STATUS_BUTTON_STYLES: Record<AttendanceStatus, StatusButtonStyle> =
  {
    present: {
      selected: "bg-green-600 text-white ring-2 ring-green-700/40",
      idle: "border border-green-200 bg-green-50 text-green-800 hover:bg-green-100",
    },
    absent_pending: {
      selected: "bg-red-600 text-white ring-2 ring-red-700/40",
      idle: "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
    },
    waive: {
      selected: "bg-zinc-600 text-white ring-2 ring-zinc-500/40",
      idle: "border border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
    },
    pause: {
      selected: "bg-zinc-600 text-white ring-2 ring-zinc-500/40",
      idle: "border border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
    },
    free_trial: {
      selected: "bg-blue-600 text-white ring-2 ring-blue-700/40",
      idle: "border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
    },
    makeup_scheduled: {
      selected: "bg-yellow-500 text-yellow-950 ring-2 ring-yellow-600/40",
      idle: "border border-yellow-300 bg-yellow-50 text-yellow-900 hover:bg-yellow-100",
    },
    makeup_done: {
      selected: "bg-green-600 text-white ring-2 ring-green-700/40",
      idle: "border border-green-200 bg-green-50 text-green-800 hover:bg-green-100",
    },
    makeup_absent: {
      selected: "bg-red-600 text-white ring-2 ring-red-700/40",
      idle: "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
    },
  };

export function statusButtonClassName(
  status: AttendanceStatus,
  selected: boolean,
): string {
  const base = "rounded-full px-2.5 py-1 text-xs font-medium transition-colors";
  const style = STATUS_BUTTON_STYLES[status];
  return `${base} ${selected ? style.selected : style.idle}`;
}
