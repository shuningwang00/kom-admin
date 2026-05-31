import { isWalkInAttendance } from "@/lib/attendance/walk-in";
import type { AttendanceStatus } from "@/lib/attendance/status";
import { parseMakeupDateFromNote } from "@/lib/attendance/status";
import { sessionIsoDate } from "@/lib/dates/session-date";

export type MakeupBooking = {
  sessionId: string;
  scheduledDate: string;
  makeupNote: string;
};

function sessionDateNorm(sessionDate: string): string {
  return sessionIsoDate(sessionDate);
}

/** Staff waived this session — not billable / not in expected headcount. */
export function isWaivedOnSession(
  studentId: string,
  waiveOnSession: Set<string>,
  status: AttendanceStatus,
): boolean {
  return waiveOnSession.has(studentId) || status === "waive";
}

/** Attending this session as the booked M/U lesson (not a missed-lesson link row). */
export function isMuLessonAttendee(
  sessionDate: string,
  status: AttendanceStatus,
  makeupNote: string,
): boolean {
  if (!/MU on/i.test(makeupNote)) return false;
  if (!isMakeupLessonSession(sessionDate, makeupNote)) return false;
  return status === "makeup_scheduled" || status === "present";
}

/** True when this session is the M/U lesson day (student should be marked present there). */
export function isMakeupLessonSession(
  sessionDate: string,
  makeupNote: string,
): boolean {
  const norm = sessionDateNorm(sessionDate);
  const muDate = parseMakeupDateFromNote(makeupNote, norm);
  return Boolean(muDate && muDate === norm);
}

/** Same day: M/U lesson is on another slot, so not this regular lesson. */
export function isAwayForMakeupOnAnotherSession(
  studentId: string,
  sessionId: string,
  sessionDate: string,
  bookingsByStudent: Map<string, MakeupBooking[]>,
): boolean {
  const norm = sessionDateNorm(sessionDate);
  const bookings = bookingsByStudent.get(studentId) ?? [];
  return bookings.some((b) => {
    if (b.sessionId === sessionId) return false;
    const bookingDate = sessionDateNorm(b.scheduledDate);
    if (bookingDate !== norm) return false;
    const muDate = parseMakeupDateFromNote(b.makeupNote, bookingDate);
    return Boolean(muDate && muDate === norm);
  });
}

/** Missed lesson already has a staff M/U link on this attendance row. */
export function isMissedLessonWithScheduledMakeup(
  sessionDate: string,
  status: AttendanceStatus,
  makeupNote: string,
): boolean {
  if (status !== "makeup_scheduled" && status !== "makeup_done") return false;
  return !isMakeupLessonSession(sessionDate, makeupNote);
}

/** Roster student should not appear on this session's attendance marking UI. */
export function isHiddenFromSessionAttendance(
  studentId: string,
  sessionId: string,
  sessionDate: string,
  status: AttendanceStatus,
  isMakeupVisitor: boolean,
  bookingsByStudent: Map<string, MakeupBooking[]>,
  makeupNote = "",
  trialAttendedAt?: string | null,
): boolean {
  if (isMakeupVisitor) return false;
  if (isWalkInAttendance(makeupNote)) return false;

  const trialDay = trialAttendedAt?.trim()
    ? sessionDateNorm(trialAttendedAt)
    : null;
  if (trialDay && sessionDateNorm(sessionDate) === trialDay) {
    return false;
  }

  if (isMissedLessonWithScheduledMakeup(sessionDate, status, makeupNote)) {
    return true;
  }

  return isAwayForMakeupOnAnotherSession(
    studentId,
    sessionId,
    sessionDate,
    bookingsByStudent,
  );
}
