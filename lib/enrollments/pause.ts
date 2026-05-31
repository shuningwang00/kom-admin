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
