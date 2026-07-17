import { sessionIsoDate } from "@/lib/dates/session-date";

/** True when the session falls inside an enrollment pause window. */
export function isEnrollmentPausedOnDate(params: {
  sessionDate: string;
  pauseStartedAt?: string | null;
  pauseEndedAt?: string | null;
}): boolean {
  const start = params.pauseStartedAt?.trim()
    ? sessionIsoDate(params.pauseStartedAt)
    : null;
  if (!start) return false;

  const session = sessionIsoDate(params.sessionDate);
  if (session < start) return false;

  const end = params.pauseEndedAt?.trim()
    ? sessionIsoDate(params.pauseEndedAt)
    : null;
  /** Pause end is the first day back on sessions (same rule as withdrawal). */
  if (end && session >= end) return false;

  return true;
}

export function validatePauseDates(
  pauseStartedAt: string,
  pauseEndedAt: string | null | undefined,
): string | null {
  const start = pauseStartedAt.trim();
  if (!start) return "Pause start date is required.";
  if (!pauseEndedAt?.trim()) return null;
  const end = pauseEndedAt.trim();
  if (end <= start) {
    return "Pause end must be after pause start (first day back on class).";
  }
  return null;
}

/** False when the enrollment is paused for every session day in the billing month. */
export function isEnrollmentBillableInMonth(params: {
  monthStart: string;
  /** First day of the month after the billing month (exclusive end). */
  monthEndExclusive: string;
  pauseStartedAt?: string | null;
  pauseEndedAt?: string | null;
}): boolean {
  const pauseStart = params.pauseStartedAt?.trim()
    ? sessionIsoDate(params.pauseStartedAt)
    : null;
  if (!pauseStart) return true;

  const { monthStart, monthEndExclusive } = params;
  if (pauseStart >= monthEndExclusive) return true;

  const pauseEnd = params.pauseEndedAt?.trim()
    ? sessionIsoDate(params.pauseEndedAt)
    : null;
  if (pauseEnd && pauseEnd <= monthStart) return true;

  if (pauseStart <= monthStart && (!pauseEnd || pauseEnd >= monthEndExclusive)) {
    return false;
  }

  return true;
}
