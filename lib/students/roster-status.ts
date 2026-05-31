import { formatCalendarDate } from "@/lib/dates/calendar";
import { isEnrollmentPausedOnDate } from "@/lib/enrollments/pause";

export type StudentRosterStatus = "Active" | "Paused" | "Withdrawn";

type EnrollmentPauseFields = {
  pauseStartedAt: string | null;
  pauseEndedAt: string | null;
};

function todayIso(): string {
  const now = new Date();
  return formatCalendarDate(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
  );
}

export function studentRosterStatus(
  activeEnrollments: EnrollmentPauseFields[],
  referenceDate: string = todayIso(),
): StudentRosterStatus {
  if (activeEnrollments.length === 0) return "Withdrawn";
  const anyPaused = activeEnrollments.some((e) =>
    isEnrollmentPausedOnDate({
      sessionDate: referenceDate,
      pauseStartedAt: e.pauseStartedAt,
      pauseEndedAt: e.pauseEndedAt,
    }),
  );
  if (anyPaused) return "Paused";
  return "Active";
}

export function rosterStatusBadgeClass(status: StudentRosterStatus): string {
  switch (status) {
    case "Active":
      return "border-green-200 bg-green-50 text-green-900";
    case "Paused":
      return "border-violet-200 bg-violet-50 text-violet-900";
    case "Withdrawn":
      return "border-zinc-200 bg-zinc-100 text-zinc-600";
  }
}
