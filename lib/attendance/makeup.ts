import { writeAuditLog } from "@/lib/attendance/audit";
import {
  isAutomaticAttendanceRepairEnabled,
  isStaffSavedAttendanceActor,
} from "@/lib/attendance/data-preservation";
import {
  canonicalSlotTimeLabel,
  findSessionForMakeupSlot,
} from "@/lib/attendance/session-slot-matching";
import { sameProgramme } from "@/lib/classes/match-programme";
import {
  formatMakeupNote,
  formatMakeupNoteWithTimeFromIso,
  parseMakeupDateFromNote,
  parseMakeupTimeFromNote,
} from "@/lib/attendance/status";
import { sessionDateMatchesClassWeekday } from "@/lib/dates/calendar";
import { sessionIsoDate } from "@/lib/dates/session-date";
import type { AttendanceStatus } from "@/lib/attendance/status";
import type { SessionUser } from "@/lib/auth/config";
import { getDb } from "@/lib/db/index";
import {
  attendanceRecords,
  classSessions,
  classes,
  enrollments,
} from "@/lib/db/schema";
import {
  isWithinCentreHours,
  normalizeTimeLabel,
  resolveRescheduleTimeLabel,
} from "@/lib/scheduling/time-slots";
import { normalizeReliefForStorage } from "@/lib/tutors/relief-form";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, ne } from "drizzle-orm";

const LINKED_MAKEUP_STATUSES: AttendanceStatus[] = [
  "makeup_scheduled",
  "makeup_done",
];

/** Absences that can pair with an M/U booking (waived lessons are excluded). */
const MISSED_LESSON_STATUSES: AttendanceStatus[] = ["absent_pending"];

async function upsertMakeupAttendance(
  db: ReturnType<typeof getDb>,
  actor: SessionUser,
  sessionId: string,
  studentId: string,
  note: string,
) {
  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.sessionId, sessionId),
        eq(attendanceRecords.studentId, studentId),
      ),
    )
    .limit(1);

  const before = existing
    ? { status: existing.status, makeupNote: existing.makeupNote }
    : {};

  if (existing) {
    await db
      .update(attendanceRecords)
      .set({
        status: "makeup_scheduled",
        makeupNote: note,
        updatedBy: actor.email,
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, existing.id));
  } else {
    await db.insert(attendanceRecords).values({
      sessionId,
      studentId,
      status: "makeup_scheduled",
      makeupNote: note,
      updatedBy: actor.email,
    });
  }

  await writeAuditLog({
    actor,
    action: "schedule_makeup",
    entityType: "attendance",
    entityId: `${sessionId}:${studentId}`,
    before,
    after: { status: "makeup_scheduled", makeupNote: note },
  });
}

export async function scheduleMakeup(params: {
  actor: SessionUser;
  /** Class the student missed (for programme matching & permissions). */
  sourceClassId: string;
  /** Session they missed — marked M/U scheduled so they leave the pending list. */
  sourceSessionId?: string;
  studentId: string;
  makeupDate: string;
  note?: string;
  /** Peer class to join; defaults to source class when omitted. */
  makeupClassId?: string;
  timeLabel?: string;
  /** Custom slot on source class — covering tutor (empty = class tutor). */
  reliefTutor?: string;
}) {
  const db = getDb();
  const date = params.makeupDate.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("makeupDate (YYYY-MM-DD) is required.");
  }

  const [sourceClass] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, params.sourceClassId))
    .limit(1);
  if (!sourceClass) throw new Error("Class not found.");

  const targetClassId = params.makeupClassId?.trim() || params.sourceClassId;
  const isCustomOnSourceClass = !params.makeupClassId?.trim();

  const [targetClass] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, targetClassId))
    .limit(1);
  if (!targetClass) throw new Error("Makeup class not found.");
  if (!targetClass.isActive) throw new Error("That class is not active.");

  if (!sameProgramme(sourceClass, targetClass)) {
    throw new Error("Makeup class must be the same level and subject.");
  }

  const [enrolled] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.classId, targetClassId),
        isNull(enrollments.endedAt),
      ),
    )
    .limit(1);
  if (!enrolled) {
    throw new Error("That class has no active enrollments.");
  }

  const resolvedTime = params.timeLabel?.trim()
    ? resolveRescheduleTimeLabel(params.timeLabel, targetClass.time)
    : targetClass.time;
  if (params.timeLabel?.trim() && !normalizeTimeLabel(resolvedTime)) {
    throw new Error("Pick a valid time slot (1h 45min).");
  }
  if (!isWithinCentreHours(resolvedTime)) {
    throw new Error("Time must be within centre hours (9am–8pm).");
  }

  const sessionReliefTutor = isCustomOnSourceClass
    ? normalizeReliefForStorage(targetClass.tutor, params.reliefTutor)
    : "";

  let session =
    (await findSessionForMakeupSlot(
      db,
      date,
      targetClass,
      resolvedTime,
      sessionReliefTutor,
    )) ?? undefined;

  if (!session) {
    [session] = await db
      .insert(classSessions)
      .values({
        classId: targetClassId,
        scheduledDate: date,
        timeLabel: resolvedTime,
        rescheduleNote: "Makeup session",
        reliefTutor: sessionReliefTutor,
      })
      .returning();
  } else {
    const patch: {
      timeLabel?: string;
      reliefTutor?: string;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    const isAdHocMakeup = session.rescheduleNote === "Makeup session";
    if (isAdHocMakeup && session.timeLabel !== resolvedTime) {
      patch.timeLabel = resolvedTime;
    }
    if (isCustomOnSourceClass) patch.reliefTutor = sessionReliefTutor;
    if (patch.timeLabel !== undefined || patch.reliefTutor !== undefined) {
      [session] = await db
        .update(classSessions)
        .set(patch)
        .where(eq(classSessions.id, session.id))
        .returning();
    }
  }

  let note =
    params.note?.trim() ||
    formatMakeupNote(new Date(`${date}T12:00:00`));
  if (params.timeLabel?.trim() && !parseMakeupTimeFromNote(note)) {
    note = formatMakeupNoteWithTimeFromIso(date, resolvedTime);
  }

  await upsertMakeupAttendance(
    db,
    params.actor,
    session.id,
    params.studentId,
    note,
  );

  const sourceSessionId = params.sourceSessionId?.trim();
  if (sourceSessionId && sourceSessionId !== session.id) {
    await upsertMakeupAttendance(
      db,
      params.actor,
      sourceSessionId,
      params.studentId,
      note,
    );
  }

  return { sessionId: session.id, makeupNote: note };
}

/** Which session was missed for a given M/U target (shared note, then latest prior absence). */
export async function findMissedSessionForMakeupTarget(
  studentId: string,
  targetSessionId: string,
  targetDate: string,
  note: string,
): Promise<string | null> {
  const db = getDb();
  return findTrueMissedSessionIdForBooking(
    db,
    studentId,
    targetSessionId,
    targetDate,
    note,
  );
}

async function findTrueMissedSessionIdForBooking(
  db: ReturnType<typeof getDb>,
  studentId: string,
  targetSessionId: string,
  targetDate: string,
  note: string,
): Promise<string | null> {
  const trimmed = note.trim();
  if (!trimmed) return null;
  const targetDateNorm = sessionIsoDate(targetDate);
  const muDate = parseMakeupDateFromNote(trimmed, targetDateNorm);

  if (muDate) {
    const [missedAfterMu] = await db
      .select({ sessionId: classSessions.id })
      .from(attendanceRecords)
      .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
      .where(
        and(
          eq(attendanceRecords.studentId, studentId),
          eq(attendanceRecords.makeupNote, trimmed),
          ne(attendanceRecords.sessionId, targetSessionId),
          gt(classSessions.scheduledDate, muDate),
          inArray(attendanceRecords.status, LINKED_MAKEUP_STATUSES),
          ne(attendanceRecords.updatedBy, "system"),
        ),
      )
      .orderBy(asc(classSessions.scheduledDate))
      .limit(1);

    if (missedAfterMu?.sessionId) return missedAfterMu.sessionId;

    const [missedBeforeMu] = await db
      .select({ sessionId: classSessions.id })
      .from(attendanceRecords)
      .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
      .where(
        and(
          eq(attendanceRecords.studentId, studentId),
          eq(attendanceRecords.makeupNote, trimmed),
          ne(attendanceRecords.sessionId, targetSessionId),
          lt(classSessions.scheduledDate, muDate),
          inArray(attendanceRecords.status, LINKED_MAKEUP_STATUSES),
          ne(attendanceRecords.updatedBy, "system"),
        ),
      )
      .orderBy(desc(classSessions.scheduledDate))
      .limit(1);

    if (missedBeforeMu?.sessionId) return missedBeforeMu.sessionId;
  }

  const [row] = await db
    .select({ sessionId: classSessions.id })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.makeupNote, trimmed),
        ne(attendanceRecords.sessionId, targetSessionId),
        lt(classSessions.scheduledDate, targetDateNorm),
        inArray(attendanceRecords.status, LINKED_MAKEUP_STATUSES),
        ne(attendanceRecords.updatedBy, "system"),
      ),
    )
    .orderBy(desc(classSessions.scheduledDate))
    .limit(1);

  if (row?.sessionId) return row.sessionId;

  const [linkedAfter] = await db
    .select({ sessionId: classSessions.id })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.makeupNote, trimmed),
        ne(attendanceRecords.sessionId, targetSessionId),
        gt(classSessions.scheduledDate, targetDateNorm),
        inArray(attendanceRecords.status, LINKED_MAKEUP_STATUSES),
        ne(attendanceRecords.updatedBy, "system"),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate))
    .limit(1);

  if (linkedAfter?.sessionId) return linkedAfter.sessionId;

  const [missedAfter] = await db
    .select({ sessionId: classSessions.id })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        inArray(attendanceRecords.status, MISSED_LESSON_STATUSES),
        gt(classSessions.scheduledDate, targetDateNorm),
        ne(attendanceRecords.updatedBy, "system"),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate))
    .limit(1);

  if (missedAfter?.sessionId) return missedAfter.sessionId;

  const [missedBefore] = await db
    .select({ sessionId: classSessions.id })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        inArray(attendanceRecords.status, MISSED_LESSON_STATUSES),
        lt(classSessions.scheduledDate, targetDateNorm),
        ne(attendanceRecords.updatedBy, "system"),
      ),
    )
    .orderBy(desc(classSessions.scheduledDate))
    .limit(1);

  return missedBefore?.sessionId ?? null;
}

/** Remove only system-generated duplicate M/U rows — never staff bookings. */
export async function purgeWrongMakeupScheduledRecords() {
  if (!isAutomaticAttendanceRepairEnabled()) return;

  const { reconcileCompletedMakeupBookings } = await import(
    "@/lib/attendance/makeup-booking"
  );
  await reconcileCompletedMakeupBookings();
  const db = getDb();
  const rows = await db
    .select({
      id: attendanceRecords.id,
      studentId: attendanceRecords.studentId,
      sessionId: attendanceRecords.sessionId,
      note: attendanceRecords.makeupNote,
      sessionDate: classSessions.scheduledDate,
      updatedBy: attendanceRecords.updatedBy,
    })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(eq(attendanceRecords.status, "makeup_scheduled"));

  const toDelete: string[] = [];

  for (const row of rows) {
    if (isStaffSavedAttendanceActor(row.updatedBy)) continue;
    const note = row.note.trim();
    if (!note) {
      toDelete.push(row.id);
      continue;
    }

    const sessionDate = sessionIsoDate(row.sessionDate);
    const muDate = parseMakeupDateFromNote(note, sessionDate);
    if (!muDate) {
      toDelete.push(row.id);
      continue;
    }

    if (sessionDate > muDate) {
      const [target] = await db
        .select({
          sessionId: classSessions.id,
          scheduledDate: classSessions.scheduledDate,
        })
        .from(attendanceRecords)
        .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
        .where(
          and(
            eq(attendanceRecords.studentId, row.studentId),
            eq(attendanceRecords.makeupNote, note),
            eq(attendanceRecords.status, "makeup_scheduled"),
            eq(classSessions.scheduledDate, muDate),
          ),
        )
        .limit(1);

      if (target) {
        const missedId = await findTrueMissedSessionIdForBooking(
          db,
          row.studentId,
          target.sessionId,
          sessionIsoDate(target.scheduledDate),
          note,
        );
        if (missedId === row.sessionId) continue;
      }

      toDelete.push(row.id);
      continue;
    }

    if (sessionDate === muDate) continue;

    const [target] = await db
      .select({
        sessionId: classSessions.id,
        scheduledDate: classSessions.scheduledDate,
      })
      .from(attendanceRecords)
      .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
      .where(
        and(
          eq(attendanceRecords.studentId, row.studentId),
          eq(attendanceRecords.makeupNote, note),
          eq(attendanceRecords.status, "makeup_scheduled"),
          eq(classSessions.scheduledDate, muDate),
        ),
      )
      .limit(1);

    if (!target) {
      toDelete.push(row.id);
      continue;
    }

    const missedId = await findTrueMissedSessionIdForBooking(
      db,
      row.studentId,
      target.sessionId,
      sessionIsoDate(target.scheduledDate),
      note,
    );

    if (missedId !== row.sessionId) {
      toDelete.push(row.id);
    }
  }

  for (const id of toDelete) {
    await db.delete(attendanceRecords).where(eq(attendanceRecords.id, id));
  }
}

/** If makeup was booked elsewhere, mirror status only on the true missed lesson. */
export async function syncMissedSessionMakeupStatus(
  sourceSessionId: string,
  sourceSessionDate: string,
  studentId: string,
  actorEmail = "system",
) {
  const db = getDb();

  const [sourceRecord] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.sessionId, sourceSessionId),
        eq(attendanceRecords.studentId, studentId),
      ),
    )
    .limit(1);

  if (sourceRecord && sourceRecord.status !== "absent_pending") return;

  const futureBookings = await db
    .select({
      record: attendanceRecords,
      session: classSessions,
    })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        eq(attendanceRecords.status, "makeup_scheduled"),
        ne(attendanceRecords.sessionId, sourceSessionId),
        gt(classSessions.scheduledDate, sourceSessionDate),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate));

  let matchedNote: string | null = null;
  for (const booking of futureBookings) {
    const missedId = await findTrueMissedSessionIdForBooking(
      db,
      studentId,
      booking.session.id,
      booking.session.scheduledDate,
      booking.record.makeupNote,
    );
    if (missedId === sourceSessionId) {
      matchedNote = booking.record.makeupNote;
      break;
    }
  }

  if (!matchedNote) return;

  const note = matchedNote;
  if (sourceRecord) {
    await db
      .update(attendanceRecords)
      .set({
        status: "makeup_scheduled",
        makeupNote: note,
        updatedBy: actorEmail,
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, sourceRecord.id));
  } else {
    await db.insert(attendanceRecords).values({
      sessionId: sourceSessionId,
      studentId,
      status: "makeup_scheduled",
      makeupNote: note,
      updatedBy: actorEmail,
    });
  }
}

/**
 * Remove empty ad-hoc makeup slots on the wrong weekday only (never staff attendance).
 */
export async function purgeOffWeekdaySessions() {
  if (!isAutomaticAttendanceRepairEnabled()) return;

  const db = getDb();
  const rows = await db
    .select({
      session: classSessions,
      class: classes,
    })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(eq(classSessions.rescheduleNote, "Makeup session"));

  for (const { session, class: cls } of rows) {
    if (sessionDateMatchesClassWeekday(session.scheduledDate, cls.weekday)) {
      continue;
    }

    const [att] = await db
      .select({ id: attendanceRecords.id, updatedBy: attendanceRecords.updatedBy })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.sessionId, session.id))
      .limit(1);

    if (att && att.updatedBy !== "system") continue;

    await db
      .delete(attendanceRecords)
      .where(eq(attendanceRecords.sessionId, session.id));
    await db.delete(classSessions).where(eq(classSessions.id, session.id));
  }
}

/** Restore session.timeLabel from class timetable when M/U booking overwrote it. */
export async function reconcileMislabeledMakeupSessionTimes() {
  if (!isAutomaticAttendanceRepairEnabled()) return;

  const db = getDb();
  const rows = await db
    .select({
      session: classSessions,
      class: classes,
    })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id));

  for (const row of rows) {
    if (row.session.rescheduleNote === "Makeup session") continue;

    const canonical = canonicalSlotTimeLabel(row);
    if (!canonical || row.session.timeLabel === canonical) continue;

    await db
      .update(classSessions)
      .set({ timeLabel: canonical, updatedAt: new Date() })
      .where(eq(classSessions.id, row.session.id));
  }
}
