import { attendanceStatusEnum } from "@/lib/db/schema";
import {
  normalizeTimeLabel,
  timeLabelFromStartToken,
} from "@/lib/scheduling/time-slots";

export type AttendanceStatus =
  (typeof attendanceStatusEnum.enumValues)[number];

export const ATTENDANCE_STATUSES = attendanceStatusEnum.enumValues;

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent_pending: "Absent (pending MU)",
  absent_notified: "Needs M/U",
  waive: "Waive",
  pause: "Pause",
  free_trial: "Free trial",
  makeup_scheduled: "M/U scheduled",
  makeup_done: "M/U completed",
  makeup_absent: "Absent",
};

/** Statuses tutors pick on the session attendance screen. */
/** Enrolled students: Absent → absent_pending (shows on Makeup hub until scheduled). */
export const SESSION_MARKING_STATUSES: AttendanceStatus[] = [
  "present",
  "absent_pending",
  "absent_notified",
  "waive",
];

/** Legacy DB values no longer offered as buttons — map for display and edit draft. */
export function normalizeSessionMarkingStatus(
  status: AttendanceStatus,
): AttendanceStatus {
  if (status === "free_trial") return "present";
  if (status === "pause") return "absent_pending";
  return status;
}

export function resolveStoredMarkingStatus(
  stored: string | null | undefined,
): AttendanceStatus {
  if (!stored) return "absent_pending";
  const status = stored as AttendanceStatus;
  if (SESSION_MARKING_STATUSES.includes(status)) return status;
  return normalizeSessionMarkingStatus(status);
}

/** Makeup / walk-in students on a session — present or absent only. */
export const MAKEUP_VISITOR_MARKING_STATUSES: AttendanceStatus[] = [
  "present",
  "makeup_absent",
];

export function isBillableStatus(status: AttendanceStatus): boolean {
  return status === "present" || status === "makeup_done";
}

export const TUTOR_ALLOWED_STATUSES: AttendanceStatus[] =
  SESSION_MARKING_STATUSES;

/** Makeup booking uses schedule-makeup API, not attendance buttons. */
export const ADMIN_ONLY_STATUSES: AttendanceStatus[] = [];

export function formatMakeupNote(date: Date): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `MU on ${dd}/${mm}`;
}

/** Booking note from a calendar date (YYYY-MM-DD). */
export function formatMakeupNoteFromIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return formatMakeupNote(new Date(y, m - 1, d, 12, 0, 0));
}

/** Custom M/U slot time stored in the note, e.g. `MU on 27/05 · 2pm – 3:45pm`. */
export function formatMakeupNoteWithTimeFromIso(
  iso: string,
  timeLabel: string,
): string {
  const base = formatMakeupNoteFromIso(iso);
  const norm =
    normalizeTimeLabel(timeLabel.trim()) ||
    timeLabelFromStartToken(timeLabel.trim());
  if (!norm) return base;
  return `${base} · ${norm}`;
}

export function parseMakeupTimeFromNote(note: string): string | null {
  const sep = note.indexOf("·");
  if (sep < 0) return null;
  const timePart = note.slice(sep + 1).trim();
  return (
    normalizeTimeLabel(timePart) || timeLabelFromStartToken(timePart) || null
  );
}

/** Parse `MU on DD/MM` using the year from a reference session date (YYYY-MM-DD). */
export function parseMakeupDateFromNote(
  note: string,
  referenceIsoDate: string,
): string | null {
  const m = note.trim().match(/MU on\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i);
  if (!m) return null;
  const dd = String(Number(m[1])).padStart(2, "0");
  const mm = String(Number(m[2])).padStart(2, "0");
  let year = Number(referenceIsoDate.slice(0, 4));
  if (m[3]) {
    const y = Number(m[3]);
    year = y < 100 ? 2000 + y : y;
  }
  return `${year}-${String(mm).padStart(2, "0")}-${dd}`;
}

export function isSystemAttendanceActor(
  updatedBy: string | null | undefined,
): boolean {
  const actor = (updatedBy ?? "").trim();
  return actor === "system" || actor === "system-repair";
}
