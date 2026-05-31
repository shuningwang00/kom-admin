/**
 * Attendance and makeup rows saved by staff/tutors are the billing source of truth.
 * Automatic repair/purge on page load is disabled by default so manual work is never deleted.
 *
 * Opt-in only: set ATTENDANCE_AUTO_REPAIR=true to run legacy cleanup helpers.
 */

export function isStaffSavedAttendanceActor(
  updatedBy: string | null | undefined,
): boolean {
  const actor = (updatedBy ?? "").trim();
  if (!actor) return false;
  return actor !== "system" && actor !== "system-repair";
}

export function isAutomaticAttendanceRepairEnabled(): boolean {
  return process.env.ATTENDANCE_AUTO_REPAIR === "true";
}

/** Guard destructive maintenance — no-op unless ATTENDANCE_AUTO_REPAIR=true. */
export async function runAutomaticAttendanceRepairIfEnabled(
  work: () => Promise<void>,
): Promise<void> {
  if (!isAutomaticAttendanceRepairEnabled()) return;
  await work();
}
