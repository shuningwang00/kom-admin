import { formatClassDropdownLabel } from "@/lib/classes/display-label";
import { programmeTypeLabel } from "@/lib/classes/match-programme";
import { formatDayLabelFromIsoDate } from "@/lib/attendance/makeup-display";
import { isSessionAttendanceSaved } from "@/lib/attendance/attendance-saved";
import { isExplicitAbsentNeed } from "@/lib/attendance/explicit-absent";
import {
  findStudentMakeupBooking,
  listAllScheduledMakeupsEver,
  type MakeupHubScheduledRow,
} from "@/lib/attendance/makeup-booking";
import { formatCalendarDate } from "@/lib/dates/calendar";
import { RELIEF_TUTOR_NEEDED_VALUE } from "@/lib/tutors/constants";
import { getDb } from "@/lib/db/index";
import {
  attendanceRecords,
  classSessions,
  classes,
  students,
} from "@/lib/db/schema";
import { and, asc, desc, eq, gte, inArray, isNull } from "drizzle-orm";

export type MakeupNeedRow = {
  studentId: string;
  studentName: string;
  sourceSessionId: string;
  sourceClassId: string;
  missedDate: string;
  classLabel: string;
  programmeType: string;
};

export type { MakeupHubScheduledRow } from "@/lib/attendance/makeup-booking";

export type MakeupWaivedRow = {
  studentId: string;
  studentName: string;
  sessionId: string;
  waivedDate: string;
  classLabel: string;
  programmeType: string;
  timeLabel: string;
  dayLabel: string;
};

export type ReliefTutorNeededRow = {
  sessionId: string;
  scheduledDate: string;
  timeLabel: string;
  classLabel: string;
  regularTutor: string;
  makeupDayLabel: string;
  students: Array<{ studentId: string; studentName: string }>;
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatCalendarDate(
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
  );
}

export async function listNeedsMakeupScheduling(
  daysBack = 120,
): Promise<MakeupNeedRow[]> {
  const since = daysAgoIso(daysBack);
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
        inArray(attendanceRecords.status, ["absent_pending", "absent_notified"]),
        gte(classSessions.scheduledDate, since),
        isNull(students.archivedAt),
      ),
    )
    .orderBy(desc(classSessions.scheduledDate));

  const needs: MakeupNeedRow[] = [];

  for (const row of rows) {
    if (
      !isExplicitAbsentNeed(
        row.record.status,
        row.record.updatedBy,
        row.record.makeupNote,
      )
    ) {
      continue;
    }

    const booked = await findStudentMakeupBooking(
      row.student.id,
      row.session.id,
    );
    if (booked) continue;

    needs.push({
      studentId: row.student.id,
      studentName: row.student.name,
      sourceSessionId: row.session.id,
      sourceClassId: row.class.id,
      missedDate: row.session.scheduledDate,
      classLabel: formatClassDropdownLabel(row.class),
      programmeType: programmeTypeLabel(row.class),
    });
  }

  return needs;
}

/** Staff-saved waive on a session — no makeup scheduled. */
export async function listWaivedClasses(
  daysBack = 120,
): Promise<MakeupWaivedRow[]> {
  const since = daysAgoIso(daysBack);
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
        eq(attendanceRecords.status, "waive"),
        gte(classSessions.scheduledDate, since),
        isNull(students.archivedAt),
      ),
    )
    .orderBy(desc(classSessions.scheduledDate));

  const waived: MakeupWaivedRow[] = [];
  for (const row of rows) {
    if (!isSessionAttendanceSaved(row.record)) continue;
    waived.push({
      studentId: row.student.id,
      studentName: row.student.name,
      sessionId: row.session.id,
      waivedDate: row.session.scheduledDate,
      classLabel: formatClassDropdownLabel(row.class),
      programmeType: programmeTypeLabel(row.class),
      timeLabel: row.session.timeLabel,
      dayLabel: formatDayLabelFromIsoDate(row.session.scheduledDate),
    });
  }

  return waived;
}

export async function listReliefTutorNeededSessions(
  daysBack = 14,
  daysForward = 120,
): Promise<ReliefTutorNeededRow[]> {
  const since = daysAgoIso(daysBack);
  const forward = (() => {
    const d = new Date();
    d.setDate(d.getDate() + daysForward);
    return formatCalendarDate(
      d.getFullYear(),
      d.getMonth() + 1,
      d.getDate(),
    );
  })();

  const db = getDb();
  const sessions = await db
    .select({
      session: classSessions,
      class: classes,
    })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(
      and(
        eq(classSessions.reliefTutor, RELIEF_TUTOR_NEEDED_VALUE),
        gte(classSessions.scheduledDate, since),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate));

  const rows: ReliefTutorNeededRow[] = [];

  for (const { session, class: cls } of sessions) {
    if (session.scheduledDate > forward) continue;

    const makeupStudents = await db
      .select({
        studentId: students.id,
        studentName: students.name,
      })
      .from(attendanceRecords)
      .innerJoin(students, eq(attendanceRecords.studentId, students.id))
      .where(
        and(
          eq(attendanceRecords.sessionId, session.id),
          eq(attendanceRecords.status, "makeup_scheduled"),
          isNull(students.archivedAt),
        ),
      );

    rows.push({
      sessionId: session.id,
      scheduledDate: session.scheduledDate,
      timeLabel: session.timeLabel,
      classLabel: formatClassDropdownLabel(cls),
      regularTutor: cls.tutor,
      makeupDayLabel: formatDayLabelFromIsoDate(session.scheduledDate),
      students: makeupStudents.map((s) => ({
        studentId: s.studentId,
        studentName: s.studentName,
      })),
    });
  }

  rows.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  return rows;
}

export async function loadMakeupHub() {
  const [needs, scheduled, reliefNeeded, waived] = await Promise.all([
    listNeedsMakeupScheduling(),
    listAllScheduledMakeupsEver(),
    listReliefTutorNeededSessions(),
    listWaivedClasses(),
  ]);
  return { needs, scheduled, reliefNeeded, waived };
}
