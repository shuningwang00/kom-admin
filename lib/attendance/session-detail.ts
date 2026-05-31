import {
  isSessionAttendanceSaved,
  pickConsolidatedAttendanceRecord,
} from "@/lib/attendance/attendance-saved";
import { isAutomaticAttendanceRepairEnabled } from "@/lib/attendance/data-preservation";
import { formatMakeupNoteForMuLessonDay } from "@/lib/attendance/makeup-display";
import { findMissedSessionForMakeupTarget } from "@/lib/attendance/makeup";
import {
  listScheduledMakeupsForSessionPage,
  type ScheduledMakeupView,
} from "@/lib/attendance/makeup-booking";
import { isWalkInAttendance } from "@/lib/attendance/walk-in";
import { isMakeupLessonSession } from "@/lib/attendance/makeup-session-rules";
import {
  isEnrollmentActiveOnDate,
  isFreeTrialOnSession,
} from "@/lib/enrollments/eligibility";
import { listTrialLeadsForSession } from "@/lib/attendance/trial-lead-attendance";
import { shouldMarkMakeupVisitor } from "@/lib/attendance/session-headcount";
import {
  canonicalSlotTimeLabel,
  consolidatedSessionIds,
  listSessionsInConsolidationGroup,
} from "@/lib/attendance/session-slot-matching";
import {
  isHiddenFromSessionAttendance,
  loadMakeupBookingsByStudent,
} from "@/lib/attendance/session-roster-visibility";
import { sessionIsoDate } from "@/lib/dates/session-date";
import type { AttendanceStatus } from "@/lib/attendance/status";
import { getDb } from "@/lib/db/index";
import {
  attendanceRecords,
  classSessions,
  classes,
  enrollments,
  students,
} from "@/lib/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";

type SessionStudentRow = {
  student: typeof students.$inferSelect;
  enrollment?: typeof enrollments.$inferSelect;
  record: typeof attendanceRecords.$inferSelect | null;
  status: AttendanceStatus;
  makeupNote: string;
  makeupDisplayNote: string;
  isMakeupVisitor: boolean;
  isWalkIn: boolean;
};

async function resolveMakeupDisplayNote(
  row: Pick<SessionStudentRow, "student" | "makeupNote">,
  sessionId: string,
  sessionDate: string,
): Promise<string> {
  const note = row.makeupNote.trim();
  if (!note || !/MU on/i.test(note)) return note;
  if (!isMakeupLessonSession(sessionDate, note)) return note;

  const missedId = await findMissedSessionForMakeupTarget(
    row.student.id,
    sessionId,
    sessionIsoDate(sessionDate),
    note,
  );
  if (!missedId) return note;

  const db = getDb();
  const [missedSession] = await db
    .select({ scheduledDate: classSessions.scheduledDate })
    .from(classSessions)
    .where(eq(classSessions.id, missedId))
    .limit(1);

  return formatMakeupNoteForMuLessonDay(
    sessionDate,
    note,
    missedSession?.scheduledDate,
  );
}

export type SessionRosterStudent = { id: string; name: string };

export async function loadSessionDetail(sessionId: string) {
  const db = getDb();
  const [session] = await db
    .select({
      session: classSessions,
      class: classes,
    })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(eq(classSessions.id, sessionId))
    .limit(1);

  if (!session) return null;

  if (isAutomaticAttendanceRepairEnabled()) {
    await db
      .delete(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.sessionId, sessionId),
          eq(attendanceRecords.status, "absent_pending"),
          eq(attendanceRecords.updatedBy, "system"),
        ),
      );
  }

  const missedDate = session.session.scheduledDate;

  const consolidationGroup = await listSessionsInConsolidationGroup(
    db,
    session,
  );
  const consolidatedIds = await consolidatedSessionIds(db, sessionId);

  const roster = await db
    .select({
      student: students,
      enrollment: enrollments,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(
      and(
        eq(enrollments.classId, session.class.id),
        isNull(students.archivedAt),
      ),
    );

  const rosterByStudentId = new Map<
    string,
    { student: typeof students.$inferSelect; enrollment: typeof enrollments.$inferSelect }
  >();
  for (const row of roster) {
    if (!rosterByStudentId.has(row.student.id)) {
      rosterByStudentId.set(row.student.id, row);
    }
  }
  const sessionDate = session.session.scheduledDate;
  const rosterDeduped = [...rosterByStudentId.values()].filter(
    ({ student, enrollment }) =>
      isEnrollmentActiveOnDate({
        sessionDate,
        enrollmentStartedAt: enrollment.startedAt,
        studentStartDate: student.startDate,
        enrollmentEndedAt: enrollment.endedAt,
        pauseStartedAt: enrollment.pauseStartedAt,
        pauseEndedAt: enrollment.pauseEndedAt,
        trialAttendedAt: enrollment.trialAttendedAt,
      }),
  );

  const rosterForMakeup: SessionRosterStudent[] = rosterDeduped.map((r) => ({
    id: r.student.id,
    name: r.student.name,
  }));

  const existing = await db
    .select()
    .from(attendanceRecords)
    .where(inArray(attendanceRecords.sessionId, consolidatedIds));

  const byStudent = new Map<string, (typeof existing)[0]>();
  for (const studentId of new Set(existing.map((r) => r.studentId))) {
    const picked = pickConsolidatedAttendanceRecord(
      existing,
      studentId,
      sessionId,
    );
    if (picked) byStudent.set(studentId, picked);
  }
  const rosterIds = new Set(rosterDeduped.map((r) => r.student.id));
  const defaultStatus: AttendanceStatus = "absent_pending";

  const sessionDateIso = sessionIsoDate(missedDate);

  const allRows: SessionStudentRow[] = await Promise.all(
    rosterDeduped.map(async ({ student, enrollment }) => {
      const record = byStudent.get(student.id);
      const makeupNote = record?.makeupNote ?? "";
      const recordSessionId = record?.sessionId ?? sessionId;
      return {
        student,
        enrollment,
        record: record ?? null,
        status: (record?.status ?? defaultStatus) as AttendanceStatus,
        makeupNote,
        makeupDisplayNote: await resolveMakeupDisplayNote(
          { student, makeupNote },
          recordSessionId,
          sessionDateIso,
        ),
        isMakeupVisitor: enrollment.classId !== session.class.id,
        isWalkIn: isWalkInAttendance(record?.makeupNote),
      };
    }),
  );

  const visitorIds = [
    ...new Set(
      existing
        .filter((r) => !rosterIds.has(r.studentId))
        .map((r) => r.studentId),
    ),
  ];

  if (visitorIds.length > 0) {
    const visitorStudents = await db
      .select()
      .from(students)
      .where(
        and(inArray(students.id, visitorIds), isNull(students.archivedAt)),
      );

    const visitorById = new Map(visitorStudents.map((s) => [s.id, s]));

    const visitorsAdded = new Set<string>();
    for (const studentId of visitorIds) {
      if (visitorsAdded.has(studentId)) continue;
      const record = pickConsolidatedAttendanceRecord(
        existing,
        studentId,
        sessionId,
      );
      if (!record) continue;
      const makeupNote = record.makeupNote ?? "";
      if (
        !shouldMarkMakeupVisitor(missedDate, {
          status: record.status as AttendanceStatus,
          makeupNote,
          updatedBy: record.updatedBy,
        })
      ) {
        continue;
      }
      const student = visitorById.get(studentId);
      if (!student) continue;
      visitorsAdded.add(studentId);
      allRows.push({
        student,
        record,
        status: record.status as AttendanceStatus,
        makeupNote,
        makeupDisplayNote: await resolveMakeupDisplayNote(
          { student, makeupNote },
          record.sessionId,
          sessionDateIso,
        ),
        isMakeupVisitor: true,
        isWalkIn: isWalkInAttendance(record.makeupNote),
      });
    }
  }

  const rosterStudentIds = rosterDeduped.map((r) => r.student.id);
  const bookingsByStudent = await loadMakeupBookingsByStudent(rosterStudentIds);

  const visibleStudents = allRows.filter((row) => {
    const recordSessionId = row.record?.sessionId ?? sessionId;
    return !isHiddenFromSessionAttendance(
      row.student.id,
      recordSessionId,
      missedDate,
      row.status,
      row.isMakeupVisitor,
      bookingsByStudent,
      row.makeupNote,
      row.enrollment?.trialAttendedAt,
    );
  });

  const hiddenStudentIds = allRows
    .filter((row) => {
      if (row.isMakeupVisitor) return false;
      const recordSessionId = row.record?.sessionId ?? sessionId;
      return isHiddenFromSessionAttendance(
        row.student.id,
        recordSessionId,
        missedDate,
        row.status,
        row.isMakeupVisitor,
        bookingsByStudent,
        row.makeupNote,
        row.enrollment?.trialAttendedAt,
      );
    })
    .map((row) => row.student.id);

  const scheduledMakeups = await listScheduledMakeupsForSessionPage(
    sessionId,
    hiddenStudentIds,
  );

  const trialLeads = await listTrialLeadsForSession(
    session.class.id,
    missedDate,
  );

  return {
    session: session.session,
    class: session.class,
    students: visibleStudents,
    trialLeads,
    rosterForMakeup,
    scheduledMakeups,
  };
}

/** Attendance rows are created when the tutor saves — not on page load. */
export async function ensureAttendanceRows(_sessionId: string, _classId: string) {
  return;
}

export type SessionDetailPayload = NonNullable<
  Awaited<ReturnType<typeof loadSessionDetail>>
>;

export function toSessionDetailResponse(
  detail: SessionDetailPayload,
  role?: "owner" | "staff" | "tutor",
) {
  return {
    session: {
      id: detail.session.id,
      scheduledDate: detail.session.scheduledDate,
      timeLabel: canonicalSlotTimeLabel({
        session: detail.session,
        class: detail.class,
      }),
      rescheduleNote: detail.session.rescheduleNote,
      reliefTutor: detail.session.reliefTutor,
    },
    class: {
      id: detail.class.id,
      label: detail.class.label,
      level: detail.class.level,
      tutor: detail.class.tutor,
      time: detail.class.time,
    },
    students: detail.students.map((row) => ({
      student: { id: row.student.id, name: row.student.name },
      status: row.status,
      makeupNote: row.makeupNote,
      makeupDisplayNote: row.makeupDisplayNote,
      isMakeupVisitor: row.isMakeupVisitor,
      isWalkIn: row.isWalkIn,
      isFreeTrial: row.enrollment
        ? isFreeTrialOnSession({
            sessionDate: detail.session.scheduledDate,
            freeTrial: row.enrollment.freeTrial,
            trialAttendedAt: row.enrollment.trialAttendedAt,
          })
        : false,
      attendanceSaved: isSessionAttendanceSaved(row.record),
    })),
    trialLeads: detail.trialLeads,
    rosterForMakeup: detail.rosterForMakeup,
    scheduledMakeups: detail.scheduledMakeups,
    ...(role !== undefined ? { role } : {}),
  };
}

export type { ScheduledMakeupView };
