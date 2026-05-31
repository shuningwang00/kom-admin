import { isStaffSavedAttendanceActor } from "@/lib/attendance/data-preservation";

export type AttendanceRecordPick = {
  sessionId: string;
  studentId: string;
  status: string;
  updatedBy: string;
};

/** True after tutor/staff saved attendance on the session (not M/U booking alone). */
export function isSessionAttendanceSaved(
  record: { updatedBy: string; status: string } | null | undefined,
): boolean {
  if (!record) return false;
  if (record.status === "makeup_scheduled") return false;
  return isStaffSavedAttendanceActor(record.updatedBy);
}

/** Peer-class slots may have one row per session; prefer the tutor-saved row for UI + saves. */
export function pickConsolidatedAttendanceRecord<T extends AttendanceRecordPick>(
  records: T[],
  studentId: string,
  preferredSessionId: string,
): T | undefined {
  const matches = records.filter((r) => r.studentId === studentId);
  if (matches.length === 0) return undefined;

  const onPreferred = matches.find((r) => r.sessionId === preferredSessionId);
  if (onPreferred && isSessionAttendanceSaved(onPreferred)) return onPreferred;

  const saved = matches.find((r) => isSessionAttendanceSaved(r));
  if (saved) return saved;

  return onPreferred ?? matches[0];
}
