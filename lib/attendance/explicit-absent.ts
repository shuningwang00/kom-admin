import { isWalkInAttendance } from "@/lib/attendance/walk-in";

/** Rows auto-created when opening a session (legacy); not an explicit Absent mark. */
export function isAutoCreatedAbsentPending(
  status: string,
  updatedBy: string | null | undefined,
): boolean {
  return status === "absent_pending" && (updatedBy ?? "").trim() === "system";
}

/** True when a tutor (or staff) explicitly marked Absent on a session. */
export function isExplicitAbsentNeed(
  status: string,
  updatedBy: string | null | undefined,
  makeupNote: string | null | undefined,
): boolean {
  if (status !== "absent_pending") return false;
  if (isAutoCreatedAbsentPending(status, updatedBy)) return false;
  if (isWalkInAttendance(makeupNote)) return false;
  return (updatedBy ?? "").trim().length > 0;
}
