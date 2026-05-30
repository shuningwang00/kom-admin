import { attendanceStatusEnum } from "@/lib/db/schema";

export type AttendanceStatus =
  (typeof attendanceStatusEnum.enumValues)[number];

export const ATTENDANCE_STATUSES = attendanceStatusEnum.enumValues;

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent_pending: "Absent (pending)",
  waive: "Waive",
  pause: "Pause (break)",
  free_trial: "Free trial",
  makeup_scheduled: "M/U scheduled",
  makeup_done: "M/U done",
};

export function isBillableStatus(status: AttendanceStatus): boolean {
  return status === "present" || status === "makeup_done";
}

/** Tutors can set these; admins can set all including makeup schedule. */
export const TUTOR_ALLOWED_STATUSES: AttendanceStatus[] = [
  "present",
  "absent_pending",
  "waive",
  "pause",
  "free_trial",
  "makeup_done",
];

export const ADMIN_ONLY_STATUSES: AttendanceStatus[] = ["makeup_scheduled"];

export function formatMakeupNote(date: Date): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `MU on ${dd}/${mm}`;
}
