import { isEnrollmentPausedOnDate } from "@/lib/enrollments/pause";
import { sessionIsoDate } from "@/lib/dates/session-date";

/** Latest of class enrollment start and student registration start (YYYY-MM-DD). */
export function effectiveEnrollmentStartDate(
  enrollmentStartedAt: string | null | undefined,
  studentStartDate: string | null | undefined,
): string | null {
  const enrollment = enrollmentStartedAt?.trim()
    ? sessionIsoDate(enrollmentStartedAt)
    : null;
  const registration = studentStartDate?.trim()
    ? sessionIsoDate(studentStartDate)
    : null;
  if (enrollment && registration) {
    return enrollment > registration ? enrollment : registration;
  }
  return enrollment ?? registration ?? null;
}

/** Whether the student should appear on a class session roster for billing/attendance. */
export function isEnrollmentActiveOnDate(params: {
  sessionDate: string;
  enrollmentStartedAt?: string | null;
  studentStartDate?: string | null;
  enrollmentEndedAt?: string | null;
  pauseStartedAt?: string | null;
  pauseEndedAt?: string | null;
  /** One-off or converted trial: appears on this date only, before regular start. */
  trialAttendedAt?: string | null;
}): boolean {
  const session = sessionIsoDate(params.sessionDate);
  const trialDay = params.trialAttendedAt?.trim()
    ? sessionIsoDate(params.trialAttendedAt)
    : null;
  if (trialDay && session === trialDay) return true;

  if (
    isEnrollmentPausedOnDate({
      sessionDate: session,
      pauseStartedAt: params.pauseStartedAt,
      pauseEndedAt: params.pauseEndedAt,
    })
  ) {
    return false;
  }

  const ended = params.enrollmentEndedAt?.trim()
    ? sessionIsoDate(params.enrollmentEndedAt)
    : null;
  /** Withdrawal date is first day off the roster (enter day after last lesson). */
  if (ended && session >= ended) return false;

  const start = effectiveEnrollmentStartDate(
    params.enrollmentStartedAt,
    params.studentStartDate,
  );
  if (!start) return true;
  return session >= start;
}

/** Blue “Free trial” pill on the session attendance row. */
export function isFreeTrialOnSession(params: {
  sessionDate: string;
  freeTrial?: boolean;
  trialAttendedAt?: string | null;
}): boolean {
  const session = sessionIsoDate(params.sessionDate);
  const trialDay = params.trialAttendedAt?.trim()
    ? sessionIsoDate(params.trialAttendedAt)
    : null;
  if (trialDay) return session === trialDay;
  return Boolean(params.freeTrial);
}

export type SessionRosterEntry = {
  studentId: string;
  freeTrial: boolean;
  enrollmentStartedAt: string | null;
  studentStartDate: string | null;
  enrollmentEndedAt: string | null;
  pauseStartedAt: string | null;
  pauseEndedAt: string | null;
  trialAttendedAt: string | null;
};

export function filterRosterForSessionDate<T extends SessionRosterEntry>(
  roster: T[],
  sessionDate: string,
): T[] {
  return roster.filter((entry) =>
    isEnrollmentActiveOnDate({
      sessionDate,
      enrollmentStartedAt: entry.enrollmentStartedAt,
      studentStartDate: entry.studentStartDate,
      enrollmentEndedAt: entry.enrollmentEndedAt,
      pauseStartedAt: entry.pauseStartedAt,
      pauseEndedAt: entry.pauseEndedAt,
      trialAttendedAt: entry.trialAttendedAt,
    }),
  );
}
