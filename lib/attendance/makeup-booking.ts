import { formatClassDropdownLabel } from "@/lib/classes/display-label";
import {
  programmeTypeLabel,
  sameProgramme,
} from "@/lib/classes/match-programme";
import { formatDayLabelFromIsoDate } from "@/lib/attendance/makeup-display";
import type { ContactType } from "@/lib/contacts";
import { writeAuditLog } from "@/lib/attendance/audit";
import {
  findMissedSessionForMakeupTarget,
  scheduleMakeup,
} from "@/lib/attendance/makeup";
import { findSessionForMakeupSlot } from "@/lib/attendance/session-slot-matching";
import { canonicalSlotTimeLabel } from "@/lib/attendance/session-slot-matching";
import {
  normalizeTimeLabel,
  timeLabelFromStartToken,
} from "@/lib/scheduling/time-slots";
import { isEnrollmentActiveOnDate } from "@/lib/enrollments/eligibility";
import { sessionIsoDate } from "@/lib/dates/session-date";
import { MAKEUP_CUSTOM_VALUE } from "@/lib/attendance/makeup-constants";
import type { SessionUser } from "@/lib/auth/config";
import { getDb } from "@/lib/db/index";
import {
  attendanceRecords,
  classSessions,
  classes,
  enrollments,
  students,
} from "@/lib/db/schema";
import type { AttendanceStatus } from "@/lib/attendance/status";
import { isAutomaticAttendanceRepairEnabled } from "@/lib/attendance/data-preservation";
import {
  formatMakeupNoteWithTimeFromIso,
  isSystemAttendanceActor,
  parseMakeupDateFromNote,
  parseMakeupTimeFromNote,
} from "@/lib/attendance/status";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,

  lt,
  lte,
  ne,
} from "drizzle-orm";

const SOURCE_MAKEUP_STATUSES: AttendanceStatus[] = [
  "makeup_scheduled",
  "makeup_done",
];

const MAKEUP_COMPLETE_STATUSES: AttendanceStatus[] = ["present", "makeup_done"];

export function isMakeupAttendanceComplete(status: AttendanceStatus): boolean {
  return MAKEUP_COMPLETE_STATUSES.includes(status);
}

/** True when the M/U lesson day is already marked present / done (any slot). */
export async function isMakeupLessonMarkedComplete(
  studentId: string,
  makeupNote: string,
  referenceSessionDate: string,
): Promise<boolean> {
  const note = makeupNote.trim();
  if (!note) return false;

  const muDate = parseMakeupDateFromNote(
    note,
    sessionIsoDate(referenceSessionDate),
  );
  if (!muDate) return false;

  const db = getDb();
  const [row] = await db
    .select({ id: attendanceRecords.id })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.makeupNote, note),
        eq(classSessions.scheduledDate, muDate),
        inArray(attendanceRecords.status, MAKEUP_COMPLETE_STATUSES),
      ),
    )
    .limit(1);

  return Boolean(row);
}

async function resolveMakeupBookingIsComplete(
  studentId: string,
  target: MakeupBookingRow,
): Promise<boolean> {
  if (isMakeupAttendanceComplete(target.record.status as AttendanceStatus)) {
    return true;
  }
  return isMakeupLessonMarkedComplete(
    studentId,
    target.record.makeupNote,
    target.session.scheduledDate,
  );
}

export type ScheduledMakeupView = {
  studentId: string;
  studentName: string;
  makeupDate: string;
  missedDate: string;
  timeLabel: string;
  makeupClassId: string;
  makeupClassLabel: string;
  makeupProgrammeType: string;
  makeupDayLabel: string;
  missedDayLabel: string;
  makeupChoice: string;
  note: string;
  targetSessionId: string;
  primaryContact: string;
  primaryContactType: ContactType | null;
  makeupRegularTutor: string;
  makeupReliefTutor: string;
  /** M/U lesson already marked present / makeup_done on the target session. */
  isComplete?: boolean;
};

export type MakeupHubScheduledRow = ScheduledMakeupView & {
  sourceSessionId: string;
  missedDate: string;
  isComplete: boolean;
};

const BOOKING_RECORD_STATUSES: AttendanceStatus[] = [
  "makeup_scheduled",
  "makeup_done",
  "present",
];

export function isStaffMakeupBookingNote(
  makeupNote: string | null | undefined,
): boolean {
  return /MU on/i.test((makeupNote ?? "").trim());
}

export function isStaffMakeupBookingRecord(record: {
  updatedBy: string;
  makeupNote: string | null;
}): boolean {
  if (isSystemAttendanceActor(record.updatedBy)) return false;
  return isStaffMakeupBookingNote(record.makeupNote);
}

type MakeupBookingRow = {
  record: typeof attendanceRecords.$inferSelect;
  session: typeof classSessions.$inferSelect;
  class: typeof classes.$inferSelect;
};

function scheduledMakeupViewFields(
  student: typeof students.$inferSelect,
  target: MakeupBookingRow,
  source: { session: typeof classSessions.$inferSelect },
  makeupChoice: string,
  isComplete = false,
): ScheduledMakeupView {
  return {
    studentId: student.id,
    studentName: student.name,
    makeupDate: target.session.scheduledDate,
    missedDate: source.session.scheduledDate,
    timeLabel:
      parseMakeupTimeFromNote(target.record.makeupNote) ||
      (target.session.rescheduleNote === "Makeup session"
        ? target.session.timeLabel
        : canonicalSlotTimeLabel({
            session: target.session,
            class: target.class,
          })),
    makeupClassId: target.class.id,
    makeupClassLabel: formatClassDropdownLabel(target.class),
    makeupProgrammeType: programmeTypeLabel(target.class),
    makeupDayLabel: formatDayLabelFromIsoDate(target.session.scheduledDate),
    missedDayLabel: formatDayLabelFromIsoDate(source.session.scheduledDate),
    makeupChoice,
    note: target.record.makeupNote,
    targetSessionId: target.session.id,
    primaryContact: student.primaryContact,
    primaryContactType: student.primaryContactType,
    makeupRegularTutor: target.class.tutor,
    makeupReliefTutor: target.session.reliefTutor ?? "",
    isComplete,
  };
}

async function loadSourceSession(sourceSessionId: string) {
  const db = getDb();
  const [row] = await db
    .select({ session: classSessions, class: classes })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(eq(classSessions.id, sourceSessionId))
    .limit(1);
  return row ?? null;
}

async function loadMakeupBookingsForStudent(
  studentId: string,
  onOrAfterDate: string,
): Promise<MakeupBookingRow[]> {
  const db = getDb();
  return db
    .select({
      record: attendanceRecords,
      session: classSessions,
      class: classes,
    })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.status, "makeup_scheduled"),
        gte(classSessions.scheduledDate, onOrAfterDate),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate));
}

async function loadStudentMakeupScheduledRows(
  studentId: string,
): Promise<MakeupBookingRow[]> {
  const db = getDb();
  return db
    .select({
      record: attendanceRecords,
      session: classSessions,
      class: classes,
    })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.status, "makeup_scheduled"),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate));
}

/** True missed lesson for an M/U booking (earlier session, not the MU day). */
export async function resolveMissedSourceSession(
  studentId: string,
  target: MakeupBookingRow,
): Promise<NonNullable<Awaited<ReturnType<typeof loadSourceSession>>> | null> {
  const targetDate = sessionIsoDate(target.session.scheduledDate);
  const muFromNote = parseMakeupDateFromNote(target.record.makeupNote, targetDate);
  if (muFromNote && targetDate < muFromNote) {
    const self = await loadSourceSession(target.session.id);
    if (self) return self;
  }

  const missedId = await resolveSourceSessionForMakeupNote(
    studentId,
    target.session.id,
    targetDate,
    target.record.makeupNote,
  );
  if (missedId) {
    const row = await loadSourceSession(missedId);
    if (row) return row;
  }

  const note = target.record.makeupNote.trim();
  const rows = await loadStudentMakeupScheduledRows(studentId);
  const group = note
    ? rows.filter((r) => r.record.makeupNote === note)
    : rows;
  const missedFromGroup = pickMissedSessionIdFromGroup(group, target);
  if (missedFromGroup) {
    return loadSourceSession(missedFromGroup);
  }

  const fallbackId = await findMissedSessionForMakeupTarget(
    studentId,
    target.session.id,
    targetDate,
    target.record.makeupNote,
  );
  if (fallbackId) {
    return loadSourceSession(fallbackId);
  }

  return null;
}

function pickTargetBooking(
  bookings: MakeupBookingRow[],
  sourceSessionId: string,
  sourceClassId: string,
  sourceDate: string,
  sourceNote: string,
): MakeupBookingRow | null {
  const otherSession = bookings.find((b) => b.session.id !== sourceSessionId);
  if (otherSession) return otherSession;

  const sameClassOtherDay = bookings.find(
    (b) =>
      b.class.id === sourceClassId &&
      b.session.scheduledDate !== sourceDate,
  );
  if (sameClassOtherDay) return sameClassOtherDay;

  if (sourceNote) {
    const byNote = bookings.find(
      (b) =>
        b.session.id !== sourceSessionId &&
        b.record.makeupNote === sourceNote,
    );
    if (byNote) return byNote;
  }

  return bookings[0] ?? null;
}

/** Makeup-day session matched by booking note. */
async function findMakeupTargetSessionByNote(
  studentId: string,
  onOrAfterSourceDate: string,
  note: string,
  excludeSessionId: string,
  options?: { includeComplete?: boolean },
): Promise<MakeupBookingRow | null> {
  const trimmed = note.trim();
  if (!trimmed) return null;

  const db = getDb();
  const refDate = sessionIsoDate(onOrAfterSourceDate);
  const muDate = parseMakeupDateFromNote(trimmed, refDate);
  if (muDate) {
    const statusFilter = options?.includeComplete
      ? inArray(attendanceRecords.status, BOOKING_RECORD_STATUSES)
      : eq(attendanceRecords.status, "makeup_scheduled");

    const [onMuDay] = await db
      .select({
        record: attendanceRecords,
        session: classSessions,
        class: classes,
      })
      .from(attendanceRecords)
      .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
      .innerJoin(classes, eq(classSessions.classId, classes.id))
      .where(
        and(
          eq(attendanceRecords.studentId, studentId),
          eq(attendanceRecords.makeupNote, trimmed),
          eq(classSessions.scheduledDate, muDate),
          ne(attendanceRecords.sessionId, excludeSessionId),
          statusFilter,
        ),
      )
      .limit(1);
    if (onMuDay) return onMuDay;
  }

  const [row] = await db
    .select({
      record: attendanceRecords,
      session: classSessions,
      class: classes,
    })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.makeupNote, trimmed),
        ne(attendanceRecords.sessionId, excludeSessionId),
        gte(classSessions.scheduledDate, onOrAfterSourceDate),
      ),
    )
    .orderBy(desc(classSessions.scheduledDate))
    .limit(1);

  return row ?? null;
}

/** Missed lesson session linked by shared makeup note (not unrelated absences). */
export async function resolveSourceSessionForMakeupNote(
  studentId: string,
  targetSessionId: string,
  targetDate: string,
  note: string,
): Promise<string | null> {
  const trimmed = note.trim();
  if (!trimmed) return null;

  const db = getDb();
  const targetDateNorm = sessionIsoDate(targetDate);

  const [after] = await db
    .select({ sessionId: classSessions.id })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.makeupNote, trimmed),
        ne(attendanceRecords.sessionId, targetSessionId),
        gt(classSessions.scheduledDate, targetDateNorm),
        inArray(attendanceRecords.status, SOURCE_MAKEUP_STATUSES),
        ne(attendanceRecords.updatedBy, "system"),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate))
    .limit(1);

  if (after?.sessionId) return after.sessionId;

  const [before] = await db
    .select({ sessionId: classSessions.id })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.makeupNote, trimmed),
        ne(attendanceRecords.sessionId, targetSessionId),
        lt(classSessions.scheduledDate, targetDateNorm),
        inArray(attendanceRecords.status, SOURCE_MAKEUP_STATUSES),
        ne(attendanceRecords.updatedBy, "system"),
      ),
    )
    .orderBy(desc(classSessions.scheduledDate))
    .limit(1);

  return before?.sessionId ?? null;
}

type MakeupGroupRow = MakeupBookingRow & {
  student: typeof students.$inferSelect;
};

export function pickMakeupTargetRow(
  rows: MakeupBookingRow[],
  note: string,
): MakeupBookingRow {
  const sorted = [...rows].sort((a, b) =>
    a.session.scheduledDate.localeCompare(b.session.scheduledDate),
  );
  const refDate = sessionIsoDate(sorted[sorted.length - 1].session.scheduledDate);
  const muDate = parseMakeupDateFromNote(note, refDate);
  if (muDate) {
    const match = sorted.find(
      (r) => sessionIsoDate(r.session.scheduledDate) === muDate,
    );
    if (match) return match;
  }
  const staff = sorted.filter((r) => !isSystemAttendanceActor(r.record.updatedBy));
  if (staff.length) return staff[staff.length - 1];
  return sorted[sorted.length - 1];
}

/** Missed lesson = latest session before MU day in this booking (prefer staff-marked). */
export function pickMissedSessionIdFromGroup(
  rows: MakeupBookingRow[],
  targetRow: MakeupBookingRow,
): string | null {
  const targetDate = sessionIsoDate(targetRow.session.scheduledDate);
  const others = rows.filter((r) => r.session.id !== targetRow.session.id);
  if (!others.length) return null;

  const after = others
    .filter((r) => sessionIsoDate(r.session.scheduledDate) > targetDate)
    .sort((a, b) =>
      sessionIsoDate(a.session.scheduledDate).localeCompare(
        sessionIsoDate(b.session.scheduledDate),
      ),
    );
  if (after.length) {
    const staffAfter = after.filter(
      (r) => !isSystemAttendanceActor(r.record.updatedBy),
    );
    return (staffAfter[0] ?? after[0]).session.id;
  }

  const before = others
    .filter((r) => sessionIsoDate(r.session.scheduledDate) < targetDate)
    .sort((a, b) =>
      sessionIsoDate(b.session.scheduledDate).localeCompare(
        sessionIsoDate(a.session.scheduledDate),
      ),
    );
  if (!before.length) return null;
  const staff = before.filter(
    (r) => !isSystemAttendanceActor(r.record.updatedBy),
  );
  return (staff[0] ?? before[0]).session.id;
}

async function loadAttendanceRecord(
  sessionId: string,
  studentId: string,
): Promise<typeof attendanceRecords.$inferSelect | null> {
  const db = getDb();
  const [rec] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.sessionId, sessionId),
        eq(attendanceRecords.studentId, studentId),
      ),
    )
    .limit(1);
  return rec ?? null;
}

async function findStudentMakeupBookingWhenContextIsTarget(
  studentId: string,
  targetSessionId: string,
): Promise<{
  source: NonNullable<Awaited<ReturnType<typeof loadSourceSession>>>;
  sourceRecord: typeof attendanceRecords.$inferSelect | null;
  target: MakeupBookingRow;
} | null> {
  const targetSession = await loadSourceSession(targetSessionId);
  if (!targetSession) return null;

  const currentTarget = await loadAttendanceRecord(targetSessionId, studentId);
  if (
    !currentTarget ||
    isMakeupAttendanceComplete(currentTarget.status) ||
    currentTarget.status !== "makeup_scheduled"
  ) {
    return null;
  }

  const target: MakeupBookingRow = {
    record: currentTarget,
    session: targetSession.session,
    class: targetSession.class,
  };

  const missed = await resolveMissedSourceSession(studentId, target);
  if (!missed) return null;

  const sourceRecord = await loadAttendanceRecord(
    missed.session.id,
    studentId,
  );

  return {
    source: missed,
    sourceRecord,
    target,
  };
}

type StudentMakeupBookingResult = {
  source: NonNullable<Awaited<ReturnType<typeof loadSourceSession>>>;
  sourceRecord: typeof attendanceRecords.$inferSelect | null;
  target: MakeupBookingRow;
  isComplete: boolean;
};

async function findStudentMakeupBookingFromMissed(
  studentId: string,
  sourceSessionId: string,
  forDisplay = false,
): Promise<StudentMakeupBookingResult | null> {
  const source = await loadSourceSession(sourceSessionId);
  if (!source) return null;

  const bookings = await loadMakeupBookingsForStudent(
    studentId,
    source.session.scheduledDate,
  );

  let sourceRecord =
    bookings.find((b) => b.session.id === sourceSessionId)?.record ?? null;
  if (!sourceRecord) {
    sourceRecord = await loadAttendanceRecord(sourceSessionId, studentId);
  }
  const sourceNote = sourceRecord?.makeupNote ?? "";

  if (!forDisplay && bookings.length === 0 && !sourceRecord) {
    return null;
  }
  if (forDisplay && bookings.length === 0 && !isStaffMakeupBookingNote(sourceNote)) {
    return null;
  }

  let target =
    bookings.length > 0
      ? pickTargetBooking(
          bookings,
          sourceSessionId,
          source.class.id,
          source.session.scheduledDate,
          sourceNote,
        )
      : null;

  if (!target || target.session.id === sourceSessionId) {
    const byNote = await findMakeupTargetSessionByNote(
      studentId,
      source.session.scheduledDate,
      sourceNote,
      sourceSessionId,
      forDisplay ? { includeComplete: true } : undefined,
    );
    if (byNote) target = byNote;
  }

  if (!target || target.session.id === sourceSessionId) return null;

  const currentTarget = await loadAttendanceRecord(
    target.session.id,
    studentId,
  );

  if (!forDisplay) {
    if (
      !currentTarget ||
      isMakeupAttendanceComplete(currentTarget.status) ||
      currentTarget.status !== "makeup_scheduled"
    ) {
      return null;
    }
  } else if (!currentTarget && !isStaffMakeupBookingNote(sourceNote)) {
    return null;
  }

  const targetRecord = currentTarget ?? target.record;
  const resolvedTarget: MakeupBookingRow = {
    ...target,
    record: targetRecord,
  };

  const missed =
    (await resolveMissedSourceSession(studentId, resolvedTarget)) ?? source;

  const missedRecord = await loadAttendanceRecord(
    missed.session.id,
    studentId,
  );

  if (forDisplay && missed.session.id !== sourceSessionId) return null;

  return {
    source: missed,
    sourceRecord: missedRecord,
    target: resolvedTarget,
    isComplete: await resolveMakeupBookingIsComplete(
      studentId,
      resolvedTarget,
    ),
  };
}

async function findStudentMakeupBookingWhenContextIsTargetForDisplay(
  studentId: string,
  targetSessionId: string,
): Promise<StudentMakeupBookingResult | null> {
  const targetSession = await loadSourceSession(targetSessionId);
  if (!targetSession) return null;

  const currentTarget = await loadAttendanceRecord(targetSessionId, studentId);
  if (!currentTarget || !isStaffMakeupBookingNote(currentTarget.makeupNote)) {
    return null;
  }

  const target: MakeupBookingRow = {
    record: currentTarget,
    session: targetSession.session,
    class: targetSession.class,
  };

  const missed = await resolveMissedSourceSession(studentId, target);
  if (!missed) return null;

  const sourceRecord = await loadAttendanceRecord(
    missed.session.id,
    studentId,
  );

  return {
    source: missed,
    sourceRecord,
    target,
    isComplete: await resolveMakeupBookingIsComplete(studentId, target),
  };
}

/** Active bookings only — used for cancel / reschedule / sync. */
export async function findStudentMakeupBooking(
  studentId: string,
  contextSessionId: string,
): Promise<Omit<StudentMakeupBookingResult, "isComplete"> | null> {
  const fromMissed = await findStudentMakeupBookingFromMissed(
    studentId,
    contextSessionId,
    false,
  );
  if (fromMissed) {
    const { isComplete: _c, ...rest } = fromMissed;
    return rest;
  }

  const asTarget = await findStudentMakeupBookingWhenContextIsTarget(
    studentId,
    contextSessionId,
  );
  if (!asTarget) return null;
  return asTarget;
}

/** Pending and completed M/U links for session-page display. */
export async function findStudentMakeupBookingForDisplay(
  studentId: string,
  contextSessionId: string,
): Promise<StudentMakeupBookingResult | null> {
  const active = await findStudentMakeupBooking(studentId, contextSessionId);
  if (active) {
    return { ...active, isComplete: false };
  }

  const fromMissed = await findStudentMakeupBookingFromMissed(
    studentId,
    contextSessionId,
    true,
  );
  if (fromMissed) return fromMissed;

  return findStudentMakeupBookingWhenContextIsTargetForDisplay(
    studentId,
    contextSessionId,
  );
}

/** When makeup day is marked present, close out the missed-lesson booking. */
export async function syncMakeupCompleteOnSource(params: {
  actor: SessionUser;
  makeupSessionId: string;
  studentId: string;
  makeupNote: string;
}) {
  const db = getDb();
  const [makeupSession] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, params.makeupSessionId))
    .limit(1);
  if (!makeupSession) return;

  const note = params.makeupNote.trim();
  if (!note) return;

  const muDate =
    parseMakeupDateFromNote(note, makeupSession.scheduledDate) ??
    sessionIsoDate(makeupSession.scheduledDate);

  const missedRows = await db
    .select({ record: attendanceRecords })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(
      and(
        eq(attendanceRecords.studentId, params.studentId),
        eq(attendanceRecords.status, "makeup_scheduled"),
        eq(attendanceRecords.makeupNote, note),
        lte(classSessions.scheduledDate, muDate),
      ),
    );

  for (const { record } of missedRows) {
    await db
      .update(attendanceRecords)
      .set({
        status: "makeup_done",
        updatedBy: params.actor.email,
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, record.id));

    await writeAuditLog({
      actor: params.actor,
      action: "complete_makeup",
      entityType: "attendance",
      entityId: `${record.sessionId}:${params.studentId}`,
      before: { status: "makeup_scheduled", makeupNote: note },
      after: { status: "makeup_done", makeupNote: note },
    });
  }

  const staleScheduled = await db
    .select({ id: attendanceRecords.id, sessionId: attendanceRecords.sessionId })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(
      and(
        eq(attendanceRecords.studentId, params.studentId),
        eq(attendanceRecords.status, "makeup_scheduled"),
        eq(attendanceRecords.makeupNote, note),
      ),
    );

  for (const row of staleScheduled) {
    const [rec] = await db
      .select({ updatedBy: attendanceRecords.updatedBy })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.id, row.id))
      .limit(1);
    if (rec && isSystemAttendanceActor(rec.updatedBy)) {
      await db.delete(attendanceRecords).where(eq(attendanceRecords.id, row.id));
      await writeAuditLog({
        actor: params.actor,
        action: "purge_stale_makeup_scheduled",
        entityType: "attendance",
        entityId: `${row.sessionId}:${params.studentId}`,
        before: { status: "makeup_scheduled", makeupNote: note },
        after: {},
      });
    }
  }
}

/** Close stale makeup_scheduled rows when the M/U lesson is already marked. */
export async function reconcileCompletedMakeupBookings() {
  if (!isAutomaticAttendanceRepairEnabled()) return;

  const db = getDb();
  const doneRows = await db
    .select({
      record: attendanceRecords,
      sessionDate: classSessions.scheduledDate,
    })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(inArray(attendanceRecords.status, MAKEUP_COMPLETE_STATUSES));

  const seen = new Set<string>();
  for (const { record, sessionDate } of doneRows) {
    if (!isStaffMakeupBookingRecord(record)) continue;
    const note = record.makeupNote.trim();
    const key = `${record.studentId}::${note}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const muDate = parseMakeupDateFromNote(note, sessionDate);
    if (!muDate) continue;

    const missedRows = await db
      .select({ record: attendanceRecords })
      .from(attendanceRecords)
      .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
      .where(
        and(
          eq(attendanceRecords.studentId, record.studentId),
          eq(attendanceRecords.status, "makeup_scheduled"),
          eq(attendanceRecords.makeupNote, note),
          lte(classSessions.scheduledDate, muDate),
        ),
      );

    for (const { record: missed } of missedRows) {
      await db
        .update(attendanceRecords)
        .set({
          status: "makeup_done",
          updatedBy: "system",
          updatedAt: new Date(),
        })
        .where(eq(attendanceRecords.id, missed.id));
    }

    const missedAfterMu = await db
      .select({ record: attendanceRecords })
      .from(attendanceRecords)
      .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
      .where(
        and(
          eq(attendanceRecords.studentId, record.studentId),
          eq(attendanceRecords.status, "makeup_scheduled"),
          eq(attendanceRecords.makeupNote, note),
          gt(classSessions.scheduledDate, muDate),
        ),
      );

    for (const { record: missed } of missedAfterMu) {
      await db
        .update(attendanceRecords)
        .set({
          status: "makeup_done",
          updatedBy: "system",
          updatedAt: new Date(),
        })
        .where(eq(attendanceRecords.id, missed.id));
    }

  }
}

/** Next enrolled class session after M/U day in the same programme (for repair). */
async function inferMissedSessionIdAfterMu(
  studentId: string,
  muSessionId: string,
  muDate: string,
): Promise<string | null> {
  const muSession = await loadSourceSession(muSessionId);
  if (!muSession) return null;

  const db = getDb();
  const enrolledClasses = await db
    .select({ class: classes })
    .from(enrollments)
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        isNull(enrollments.endedAt),
        eq(classes.isActive, true),
      ),
    );

  const programmeClassIds = enrolledClasses
    .filter((row) => sameProgramme(row.class, muSession.class))
    .map((row) => row.class.id);

  if (!programmeClassIds.length) return null;

  const [next] = await db
    .select({ sessionId: classSessions.id })
    .from(classSessions)
    .where(
      and(
        inArray(classSessions.classId, programmeClassIds),
        gt(classSessions.scheduledDate, muDate),
        eq(classSessions.status, "scheduled"),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate))
    .limit(1);

  return next?.sessionId ?? null;
}

/** Re-create missed-lesson links removed by overly aggressive purges. */
export async function repairOrphanedMakeupBookings() {
  if (!isAutomaticAttendanceRepairEnabled()) return;

  const db = getDb();
  const doneRows = await db
    .select({
      record: attendanceRecords,
      sessionDate: classSessions.scheduledDate,
    })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(inArray(attendanceRecords.status, MAKEUP_COMPLETE_STATUSES));

  const seen = new Set<string>();
  for (const { record, sessionDate } of doneRows) {
    if (!isStaffMakeupBookingRecord(record)) continue;
    const note = record.makeupNote.trim();
    const key = `${record.studentId}::${note}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const muDate = parseMakeupDateFromNote(note, sessionDate);
    if (!muDate || sessionIsoDate(sessionDate) !== muDate) continue;

    const hasMissedLink = await resolveSourceSessionForMakeupNote(
      record.studentId,
      record.sessionId,
      sessionDate,
      note,
    );
    if (hasMissedLink) continue;

    let missedId = await findMissedSessionForMakeupTarget(
      record.studentId,
      record.sessionId,
      sessionDate,
      note,
    );
    if (!missedId) {
      missedId = await inferMissedSessionIdAfterMu(
        record.studentId,
        record.sessionId,
        muDate,
      );
    }
    if (!missedId) continue;

    const [existing] = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.sessionId, missedId),
          eq(attendanceRecords.studentId, record.studentId),
        ),
      )
      .limit(1);

    if (existing) {
      if (
        existing.status === "waive" ||
        existing.status === "absent_pending"
      ) {
        await db
          .update(attendanceRecords)
          .set({
            status: "makeup_done",
            makeupNote: note,
            updatedBy: record.updatedBy,
            updatedAt: new Date(),
          })
          .where(eq(attendanceRecords.id, existing.id));
      }
      continue;
    }

    await db.insert(attendanceRecords).values({
      sessionId: missedId,
      studentId: record.studentId,
      status: "makeup_done",
      makeupNote: note,
      updatedBy: record.updatedBy,
    });
  }
}

/** Re-create custom/off-weekday M/U lesson sessions (uses time embedded in makeup note). */
export async function ensureMakeupLessonSessionsForDate(date: string) {
  if (!isAutomaticAttendanceRepairEnabled()) return;

  await repairCustomMakeupLessonSlots();
  const iso = sessionIsoDate(date);
  const bookings = await listAllScheduledMakeupsEver();
  const db = getDb();
  const seen = new Set<string>();

  for (const booking of bookings) {
    if (sessionIsoDate(booking.makeupDate) !== iso) continue;

    const isCustom = booking.makeupChoice === MAKEUP_CUSTOM_VALUE;
    let classId = booking.makeupClassId;
    if (isCustom) {
      const missed = await loadSourceSession(booking.sourceSessionId);
      classId = missed?.class.id ?? classId;
    }
    if (!classId) continue;

    const [cls] = await db
      .select()
      .from(classes)
      .where(eq(classes.id, classId))
      .limit(1);
    if (!cls?.isActive) continue;

    const resolvedTime =
      parseMakeupTimeFromNote(booking.note) ||
      (!isCustom
        ? normalizeTimeLabel(booking.timeLabel) ||
          normalizeTimeLabel(cls.time) ||
          cls.time.trim()
        : null);
    if (!resolvedTime) continue;

    const slotKey = `${classId}|${iso}|${resolvedTime}`;
    if (seen.has(slotKey)) continue;
    seen.add(slotKey);

    let [session] = await db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.classId, classId),
          eq(classSessions.scheduledDate, iso),
          eq(classSessions.timeLabel, resolvedTime),
        ),
      )
      .limit(1);

    if (!session) {
      [session] = await db
        .insert(classSessions)
        .values({
          classId,
          scheduledDate: iso,
          timeLabel: resolvedTime,
          rescheduleNote: "Makeup session",
        })
        .returning();
    }

    const note = parseMakeupTimeFromNote(booking.note)
      ? booking.note
      : formatMakeupNoteWithTimeFromIso(iso, resolvedTime);

    const [att] = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.sessionId, session.id),
          eq(attendanceRecords.studentId, booking.studentId),
        ),
      )
      .limit(1);

    if (att) {
      if (att.makeupNote !== note) {
        await db
          .update(attendanceRecords)
          .set({ makeupNote: note, updatedAt: new Date() })
          .where(eq(attendanceRecords.id, att.id));
      }
      continue;
    }

    const status: AttendanceStatus = booking.isComplete
      ? "present"
      : "makeup_scheduled";

    await db.insert(attendanceRecords).values({
      sessionId: session.id,
      studentId: booking.studentId,
      status,
      makeupNote: note,
      updatedBy: "system-repair",
    });
  }
}

/** Fix auto-repaired slots that used class default time instead of custom time. */
export async function repairCustomMakeupLessonSlots() {
  if (!isAutomaticAttendanceRepairEnabled()) return;

  const db = getDb();

  const bookings = await listAllScheduledMakeupsEver();

  for (const booking of bookings) {
    if (booking.makeupChoice !== MAKEUP_CUSTOM_VALUE) continue;

    const muIso = sessionIsoDate(booking.makeupDate);
    const customTime = parseMakeupTimeFromNote(booking.note);
    if (!customTime) continue;

    const missed = await loadSourceSession(booking.sourceSessionId);
    const classId = missed?.class.id;
    if (!classId) continue;

    const note = formatMakeupNoteWithTimeFromIso(muIso, customTime);

    const wrongSessions = await db
      .select({ session: classSessions })
      .from(classSessions)
      .innerJoin(
        attendanceRecords,
        eq(attendanceRecords.sessionId, classSessions.id),
      )
      .where(
        and(
          eq(classSessions.classId, classId),
          eq(classSessions.scheduledDate, muIso),
          eq(attendanceRecords.studentId, booking.studentId),
          eq(classSessions.rescheduleNote, "Makeup session"),
        ),
      );

    for (const { session } of wrongSessions) {
      if (session.timeLabel === customTime) {
        await db
          .update(attendanceRecords)
          .set({ makeupNote: note, updatedAt: new Date() })
          .where(
            and(
              eq(attendanceRecords.sessionId, session.id),
              eq(attendanceRecords.studentId, booking.studentId),
            ),
          );
        continue;
      }
      await db
        .delete(attendanceRecords)
        .where(eq(attendanceRecords.sessionId, session.id));
      const others = await db
        .select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.sessionId, session.id))
        .limit(1);
      if (!others.length) {
        await db.delete(classSessions).where(eq(classSessions.id, session.id));
      }
    }

    let [session] = await db
      .select()
      .from(classSessions)
      .where(
        and(
          eq(classSessions.classId, classId),
          eq(classSessions.scheduledDate, muIso),
          eq(classSessions.timeLabel, customTime),
        ),
      )
      .limit(1);

    if (!session) {
      [session] = await db
        .insert(classSessions)
        .values({
          classId,
          scheduledDate: muIso,
          timeLabel: customTime,
          rescheduleNote: "Makeup session",
        })
        .returning();
    } else if (session.timeLabel !== customTime) {
      [session] = await db
        .update(classSessions)
        .set({ timeLabel: customTime, updatedAt: new Date() })
        .where(eq(classSessions.id, session.id))
        .returning();
    }

    for (const row of await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.studentId, booking.studentId),
          eq(attendanceRecords.makeupNote, booking.note),
        ),
      )) {
      if (row.makeupNote !== note) {
        await db
          .update(attendanceRecords)
          .set({ makeupNote: note, updatedAt: new Date() })
          .where(eq(attendanceRecords.id, row.id));
      }
    }

    const [att] = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.sessionId, session.id),
          eq(attendanceRecords.studentId, booking.studentId),
        ),
      )
      .limit(1);

    if (!att) {
      await db.insert(attendanceRecords).values({
        sessionId: session.id,
        studentId: booking.studentId,
        status: booking.isComplete ? "present" : "makeup_scheduled",
        makeupNote: note,
        updatedBy: "system-repair",
      });
    } else if (att.sessionId !== session.id) {
      await db
        .update(attendanceRecords)
        .set({
          sessionId: session.id,
          makeupNote: note,
          updatedAt: new Date(),
        })
        .where(eq(attendanceRecords.id, att.id));
    }
  }
}

/** All staff-saved M/U bookings (pending and completed), excluding phantoms. */
export async function listAllScheduledMakeupsEver(): Promise<
  MakeupHubScheduledRow[]
> {
  const db = getDb();
  const rows = await db
    .select({
      record: attendanceRecords,
      session: classSessions,
      class: classes,
      student: students,
    })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .innerJoin(students, eq(attendanceRecords.studentId, students.id))
    .where(
      and(
        inArray(attendanceRecords.status, BOOKING_RECORD_STATUSES),
        isNull(students.archivedAt),
      ),
    )
    .orderBy(desc(classSessions.scheduledDate));

  const staffRows = rows.filter((row) =>
    isStaffMakeupBookingRecord(row.record),
  );

  const byKey = new Map<string, MakeupGroupRow[]>();
  for (const row of staffRows) {
    const key = `${row.student.id}::${row.record.makeupNote.trim()}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  const scheduled: MakeupHubScheduledRow[] = [];
  const seen = new Set<string>();

  for (const group of byKey.values()) {
    const student = group[0].student;
    const note = group[0].record.makeupNote.trim();
    const refRow = pickMakeupTargetRow(group, note);
    const muDate = parseMakeupDateFromNote(
      note,
      sessionIsoDate(refRow.session.scheduledDate),
    );
    if (!muDate) continue;

    const rowOnMuDay = group.find(
      (r) => sessionIsoDate(r.session.scheduledDate) === muDate,
    );
    const displayTarget = rowOnMuDay ?? refRow;

    if (!isStaffMakeupBookingRecord(displayTarget.record)) continue;

    const missed = await resolveMissedSourceSession(student.id, displayTarget);
    if (!missed) continue;

    const missedAtt = await loadAttendanceRecord(
      missed.session.id,
      student.id,
    );
    if (missedAtt?.status === "waive") continue;

    const dedupeKey = `${student.id}:${muDate}:${missed.session.id}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const makeupChoice =
      (rowOnMuDay ?? refRow).class.id === missed.class.id
        ? MAKEUP_CUSTOM_VALUE
        : (rowOnMuDay ?? refRow).class.id;

    const view = scheduledMakeupViewFields(
      student,
      displayTarget,
      missed,
      makeupChoice,
    );

    scheduled.push({
      ...view,
      makeupDate: muDate,
      sourceSessionId: missed.session.id,
      missedDate: missed.session.scheduledDate,
      isComplete: rowOnMuDay
        ? isMakeupAttendanceComplete(
            rowOnMuDay.record.status as AttendanceStatus,
          )
        : false,
    });
  }

  return scheduled;
}

export async function listScheduledMakeupsForMissedSession(
  contextSessionId: string,
): Promise<ScheduledMakeupView[]> {
  const context = await loadSourceSession(contextSessionId);
  if (!context) return [];

  const db = getDb();
  const roster = await db
    .select({
      student: students,
      enrollmentStartedAt: enrollments.startedAt,
      enrollmentEndedAt: enrollments.endedAt,
      pauseStartedAt: enrollments.pauseStartedAt,
      pauseEndedAt: enrollments.pauseEndedAt,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(
      and(
        eq(enrollments.classId, context.class.id),
        isNull(students.archivedAt),
      ),
    );

  const views: ScheduledMakeupView[] = [];
  const seen = new Set<string>();

  for (const {
    student,
    enrollmentStartedAt,
    enrollmentEndedAt,
    pauseStartedAt,
    pauseEndedAt,
  } of roster) {
    if (
      !isEnrollmentActiveOnDate({
        sessionDate: context.session.scheduledDate,
        enrollmentStartedAt,
        studentStartDate: student.startDate,
        enrollmentEndedAt,
        pauseStartedAt,
        pauseEndedAt,
      })
    ) {
      continue;
    }
    const booking = await findStudentMakeupBookingForDisplay(
      student.id,
      contextSessionId,
    );
    if (!booking) continue;

    const { source: missed, target, isComplete } = booking;
    const involvesContext =
      missed.session.id === contextSessionId ||
      target.session.id === contextSessionId;
    if (!involvesContext) continue;

    const dedupeKey = `${student.id}:${target.session.id}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const makeupChoice =
      target.class.id === missed.class.id
        ? MAKEUP_CUSTOM_VALUE
        : target.class.id;

    views.push(
      scheduledMakeupViewFields(
        student,
        target,
        missed,
        makeupChoice,
        isComplete,
      ),
    );
  }

  views.sort((a, b) => a.studentName.localeCompare(b.studentName));
  return views;
}

/** Include M/U bookings for roster students hidden from the attendance list. */
export async function enrichScheduledMakeupsForHiddenRoster(
  contextSessionId: string,
  hiddenStudentIds: string[],
  existing: ScheduledMakeupView[],
): Promise<ScheduledMakeupView[]> {
  if (hiddenStudentIds.length === 0) return existing;

  const views = [...existing];
  const seen = new Set(
    views.map((v) => `${v.studentId}:${v.targetSessionId}`),
  );

  const db = getDb();
  for (const studentId of hiddenStudentIds) {
    const booking = await findStudentMakeupBookingForDisplay(
      studentId,
      contextSessionId,
    );
    if (!booking) continue;
    if (booking.source.session.id !== contextSessionId) continue;

    const key = `${studentId}:${booking.target.session.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    if (!student) continue;

    const makeupChoice =
      booking.target.class.id === booking.source.class.id
        ? MAKEUP_CUSTOM_VALUE
        : booking.target.class.id;

    views.push(
      scheduledMakeupViewFields(
        student,
        booking.target,
        booking.source,
        makeupChoice,
        booking.isComplete,
      ),
    );
  }

  views.sort((a, b) => a.studentName.localeCompare(b.studentName));
  return views;
}

/**
 * Scheduled M/U card on a session attendance page: only roster students hidden
 * from this session because they missed this slot (not M/U visitors from other slots).
 */
export async function listScheduledMakeupsForSessionPage(
  contextSessionId: string,
  hiddenStudentIds: string[],
): Promise<ScheduledMakeupView[]> {
  if (hiddenStudentIds.length === 0) return [];
  return enrichScheduledMakeupsForHiddenRoster(
    contextSessionId,
    hiddenStudentIds,
    [],
  );
}

export async function cancelScheduledMakeup(params: {
  actor: SessionUser;
  sourceSessionId: string;
  studentId: string;
}) {
  const db = getDb();
  const booking = await findStudentMakeupBooking(
    params.studentId,
    params.sourceSessionId,
  );
  if (!booking) throw new Error("No scheduled makeup found for this student.");

  const { sourceRecord, target } = booking;

  await db
    .delete(attendanceRecords)
    .where(eq(attendanceRecords.id, target.record.id));

  // If this was a custom makeup session ("Makeup session"), delete the session
  // row once no attendance records remain so it doesn't linger in the calendar.
  if (target.session.rescheduleNote === "Makeup session") {
    const remaining = await db
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.sessionId, target.session.id))
      .limit(1);
    if (remaining.length === 0) {
      await db.delete(classSessions).where(eq(classSessions.id, target.session.id));
    }
  }

  if (sourceRecord) {
    await db
      .update(attendanceRecords)
      .set({
        status: "absent_notified",
        makeupNote: "",
        updatedBy: params.actor.email,
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, sourceRecord.id));
  }

  await writeAuditLog({
    actor: params.actor,
    action: "cancel_makeup",
    entityType: "attendance",
    entityId: `${params.sourceSessionId}:${params.studentId}`,
    before: {
      targetSessionId: target.session.id,
      makeupDate: target.session.scheduledDate,
      note: target.record.makeupNote,
    },
    after: {},
  });
}

export async function updateScheduledMakeup(params: {
  actor: SessionUser;
  sourceSessionId: string;
  sourceClassId: string;
  studentId: string;
  makeupDate: string;
  note?: string;
  makeupClassId?: string;
  timeLabel?: string;
  reliefTutor?: string;
}) {
  const booking = await findStudentMakeupBooking(
    params.studentId,
    params.sourceSessionId,
  );
  if (!booking) throw new Error("No scheduled makeup found for this student.");

  const db = getDb();
  await db
    .delete(attendanceRecords)
    .where(eq(attendanceRecords.id, booking.target.record.id));

  if (booking.target.session.rescheduleNote === "Makeup session") {
    const remaining = await db
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.sessionId, booking.target.session.id))
      .limit(1);
    if (remaining.length === 0) {
      await db.delete(classSessions).where(eq(classSessions.id, booking.target.session.id));
    }
  }

  return scheduleMakeup({
    actor: params.actor,
    sourceClassId: params.sourceClassId,
    sourceSessionId: params.sourceSessionId,
    studentId: params.studentId,
    makeupDate: params.makeupDate,
    note: params.note,
    makeupClassId: params.makeupClassId,
    timeLabel: params.timeLabel,
    reliefTutor: params.reliefTutor,
  });
}
