/**
 * Single source of truth for daily-list preview and “students to mark”.
 * Billing will depend on these rules — keep in sync with session-headcount.test.ts.
 */
import { isSessionAttendanceSaved } from "@/lib/attendance/attendance-saved";
import {
  isHiddenFromSessionAttendance,
  isMissedLessonWithScheduledMakeup,
  isMuLessonAttendee,
  isWaivedOnSession,
  type MakeupBooking,
} from "@/lib/attendance/makeup-session-rules";
import type { SessionExpectedCounts } from "@/lib/attendance/session-expected-labels";
import { sessionIsoDate } from "@/lib/dates/session-date";
import {
  isSystemAttendanceActor,
  type AttendanceStatus,
} from "@/lib/attendance/status";

export type SessionAttendanceRecord = {
  status: AttendanceStatus;
  makeupNote: string;
  updatedBy: string;
};

export type SessionHeadcountResult = {
  expected: SessionExpectedCounts;
  studentsToMark: string[];
  savedCount: number;
};

function emptyCounts(): SessionExpectedCounts {
  return { regular: 0, trial: 0, makeup: 0 };
}

function addToExpected(
  expected: SessionExpectedCounts,
  student: {
    studentId: string;
    freeTrial: boolean;
    trialAttendedAt?: string | null;
  },
  sessionDate: string,
  record: SessionAttendanceRecord | undefined,
): void {
  const status = (record?.status ?? "absent_pending") as AttendanceStatus;

  if (status === "absent_notified") {
    expected.notified = (expected.notified ?? 0) + 1;
    return;
  }

  const trialDay = student.trialAttendedAt?.trim()
    ? sessionIsoDate(student.trialAttendedAt)
    : null;
  if (trialDay && sessionIsoDate(sessionDate) === trialDay) {
    expected.trial += 1;
    return;
  }

  const makeupNote = record?.makeupNote ?? "";
  if (isMuLessonAttendee(sessionDate, status, makeupNote)) {
    expected.makeup += 1;
    return;
  }
  if (student.freeTrial) expected.trial += 1;
  else expected.regular += 1;
}

/** Same gate for daily preview visitors and the session marking page. */
export function shouldMarkMakeupVisitor(
  sessionDate: string,
  record: SessionAttendanceRecord,
): boolean {
  if (
    record.status === "makeup_scheduled" &&
    isSystemAttendanceActor(record.updatedBy)
  ) {
    return false;
  }
  if (isMissedLessonWithScheduledMakeup(sessionDate, record.status, record.makeupNote)) {
    return false;
  }
  return isMuLessonAttendee(sessionDate, record.status, record.makeupNote);
}

/** One session row (before peer-class merge). */
export function computeSessionHeadcount(params: {
  sessionId: string;
  sessionDate: string;
  roster: Array<{
    studentId: string;
    freeTrial: boolean;
    trialAttendedAt?: string | null;
  }>;
  sessionRecords: Map<string, SessionAttendanceRecord>;
  waiveOnSession: Set<string>;
  bookingsByStudent: Map<string, MakeupBooking[]>;
}): SessionHeadcountResult {
  const {
    sessionId,
    sessionDate,
    roster,
    sessionRecords,
    waiveOnSession,
    bookingsByStudent,
  } = params;

  const expected = emptyCounts();
  const studentsToMark: string[] = [];
  const rosterIds = new Set(roster.map((r) => r.studentId));
  const countedExpected = new Set<string>();

  for (const e of roster) {
    const record = sessionRecords.get(e.studentId);
    const status = (record?.status ?? "absent_pending") as AttendanceStatus;
    const makeupNote = record?.makeupNote ?? "";

    if (isWaivedOnSession(e.studentId, waiveOnSession, status)) {
      continue;
    }

    if (
      isHiddenFromSessionAttendance(
        e.studentId,
        sessionId,
        sessionDate,
        status,
        false,
        bookingsByStudent,
        makeupNote,
        e.trialAttendedAt,
      )
    ) {
      continue;
    }

    studentsToMark.push(e.studentId);

    if (!countedExpected.has(e.studentId)) {
      countedExpected.add(e.studentId);
      addToExpected(expected, e, sessionDate, record);
    }
  }

  for (const [studentId, record] of sessionRecords) {
    if (rosterIds.has(studentId) || waiveOnSession.has(studentId)) continue;
    if (!shouldMarkMakeupVisitor(sessionDate, record)) continue;

    if (
      isHiddenFromSessionAttendance(
        studentId,
        sessionId,
        sessionDate,
        record.status,
        true,
        bookingsByStudent,
        record.makeupNote,
      )
    ) {
      continue;
    }

    studentsToMark.push(studentId);

    if (!countedExpected.has(studentId)) {
      countedExpected.add(studentId);
      expected.makeup += 1;
    }
  }

  const savedCount = studentsToMark.filter((id) =>
    isSessionAttendanceSaved(sessionRecords.get(id)),
  ).length;

  assertPreviewMatchesMarking(expected, studentsToMark);
  return { expected, studentsToMark, savedCount };
}

/**
 * Peer classes merged into one slot: host-class roster only; M/U via attendance rows.
 */
function collectWaivedOnSlot(
  recordsBySession: Map<string, Map<string, SessionAttendanceRecord>>,
): Set<string> {
  const waived = new Set<string>();
  for (const sessionRecords of recordsBySession.values()) {
    for (const [studentId, record] of sessionRecords) {
      if (record.status === "waive") waived.add(studentId);
    }
  }
  return waived;
}

export function computeConsolidatedSlotHeadcount(params: {
  sessionDate: string;
  primarySessionId: string;
  primaryRoster: Array<{
    studentId: string;
    freeTrial: boolean;
    trialAttendedAt?: string | null;
  }>;
  recordsBySession: Map<string, Map<string, SessionAttendanceRecord>>;
  bookingsByStudent: Map<string, MakeupBooking[]>;
}): SessionHeadcountResult {
  const {
    sessionDate,
    primarySessionId,
    primaryRoster,
    recordsBySession,
    bookingsByStudent,
  } = params;

  const waiveOnSlot = collectWaivedOnSlot(recordsBySession);
  const expected = emptyCounts();
  const studentsToMark = new Set<string>();
  const primaryRosterIds = new Set(primaryRoster.map((r) => r.studentId));
  const countedExpected = new Set<string>();
  const primaryRecords = recordsBySession.get(primarySessionId) ?? new Map();

  for (const e of primaryRoster) {
    const record = primaryRecords.get(e.studentId);
    const status = (record?.status ?? "absent_pending") as AttendanceStatus;
    const makeupNote = record?.makeupNote ?? "";

    if (isWaivedOnSession(e.studentId, waiveOnSlot, status)) {
      continue;
    }

    if (
      isHiddenFromSessionAttendance(
        e.studentId,
        primarySessionId,
        sessionDate,
        status,
        false,
        bookingsByStudent,
        makeupNote,
        e.trialAttendedAt,
      )
    ) {
      continue;
    }

    studentsToMark.add(e.studentId);

    if (!countedExpected.has(e.studentId)) {
      countedExpected.add(e.studentId);
      addToExpected(expected, e, sessionDate, record);
    }
  }

  for (const [sessionId, sessionRecords] of recordsBySession) {
    for (const [studentId, record] of sessionRecords) {
      if (primaryRosterIds.has(studentId)) continue;
      if (isWaivedOnSession(studentId, waiveOnSlot, record.status)) continue;
      if (!shouldMarkMakeupVisitor(sessionDate, record)) continue;

      if (
        isHiddenFromSessionAttendance(
          studentId,
          sessionId,
          sessionDate,
          record.status,
          true,
          bookingsByStudent,
          record.makeupNote,
        )
      ) {
        continue;
      }

      studentsToMark.add(studentId);

      if (!countedExpected.has(studentId)) {
        countedExpected.add(studentId);
        expected.makeup += 1;
      }
    }
  }

  const markList = [...studentsToMark];
  const savedCount = markList.filter((id) => {
    for (const sessionRecords of recordsBySession.values()) {
      const record = sessionRecords.get(id);
      if (isSessionAttendanceSaved(record)) return true;
    }
    return false;
  }).length;

  assertPreviewMatchesMarking(expected, markList);
  return { expected, studentsToMark: markList, savedCount };
}

/** Billing safety: preview headcount must match who we ask tutors to mark. */
export function assertPreviewMatchesMarking(
  expected: SessionExpectedCounts,
  studentsToMark: string[],
): void {
  const previewTotal = expected.regular + expected.trial + expected.makeup + (expected.notified ?? 0);
  const markTotal = studentsToMark.length;
  if (previewTotal !== markTotal) {
    throw new Error(
      `Attendance preview mismatch (billing risk): ${previewTotal} expected vs ${markTotal} to mark`,
    );
  }
}
