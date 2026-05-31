import {
  programmeTypeLabel,
  sameProgrammeLevel,
} from "@/lib/classes/match-programme";
import { formatClassDropdownLabel } from "@/lib/classes/display-label";
import { loadSessionDetail } from "@/lib/attendance/session-detail";
import { isEnrollmentActiveOnDate } from "@/lib/enrollments/eligibility";
import { isWalkInAttendance, WALK_IN_NOTE } from "@/lib/attendance/walk-in";
import { writeAuditLog } from "@/lib/attendance/audit";
import type { SessionUser } from "@/lib/auth/config";
import { getDb } from "@/lib/db/index";
import {
  attendanceRecords,
  classSessions,
  classes,
  enrollments,
  students,
} from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export type AddableStudent = {
  id: string;
  name: string;
  levelDisplay: string;
  classesHint: string;
};

export async function listAddableStudentsForSession(
  sessionId: string,
): Promise<{ levelLabel: string; students: AddableStudent[] } | null> {
  const db = getDb();
  const [row] = await db
    .select({ session: classSessions, class: classes })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(eq(classSessions.id, sessionId))
    .limit(1);
  if (!row) return null;

  const detail = await loadSessionDetail(sessionId);
  if (!detail) return null;

  const onListIds = new Set(detail.students.map((s) => s.student.id));

  const sessionDate = row.session.scheduledDate;

  const enrollmentRows = await db
    .select({
      student: students,
      class: classes,
      enrollmentStartedAt: enrollments.startedAt,
      trialAttendedAt: enrollments.trialAttendedAt,
      enrollmentEndedAt: enrollments.endedAt,
      pauseStartedAt: enrollments.pauseStartedAt,
      pauseEndedAt: enrollments.pauseEndedAt,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .where(
      and(isNull(enrollments.endedAt), isNull(students.archivedAt)),
    );

  const byStudent = new Map<
    string,
    { student: typeof students.$inferSelect; classes: string[] }
  >();

  for (const {
    student,
    class: cls,
    enrollmentStartedAt,
    trialAttendedAt,
    enrollmentEndedAt,
    pauseStartedAt,
    pauseEndedAt,
  } of enrollmentRows) {
    if (
      !isEnrollmentActiveOnDate({
        sessionDate,
        enrollmentStartedAt,
        studentStartDate: student.startDate,
        enrollmentEndedAt,
        pauseStartedAt,
        pauseEndedAt,
        trialAttendedAt,
      })
    ) {
      continue;
    }
    if (!sameProgrammeLevel(row.class, cls)) continue;
    const entry = byStudent.get(student.id) ?? { student, classes: [] };
    entry.classes.push(formatClassDropdownLabel(cls));
    byStudent.set(student.id, entry);
  }

  const addable: AddableStudent[] = [];
  for (const { student, classes: classLabels } of byStudent.values()) {
    if (onListIds.has(student.id)) continue;
    addable.push({
      id: student.id,
      name: student.name,
      levelDisplay: programmeTypeLabel(row.class),
      classesHint: classLabels.slice(0, 2).join("; ") || "—",
    });
  }

  addable.sort((a, b) => a.name.localeCompare(b.name));

  return {
    levelLabel: programmeTypeLabel(row.class),
    students: addable,
  };
}

export async function addWalkInStudentToSession(params: {
  actor: SessionUser;
  sessionId: string;
  studentId: string;
}) {
  const db = getDb();
  const [row] = await db
    .select({ session: classSessions, class: classes })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(eq(classSessions.id, params.sessionId))
    .limit(1);
  if (!row) throw new Error("Session not found.");

  const [student] = await db
    .select()
    .from(students)
    .where(
      and(eq(students.id, params.studentId), isNull(students.archivedAt)),
    )
    .limit(1);
  if (!student) throw new Error("Student not found.");

  const [studentRow] = await db
    .select({ startDate: students.startDate })
    .from(students)
    .where(eq(students.id, params.studentId))
    .limit(1);

  const levelRows = await db
    .select({
      class: classes,
      enrollmentStartedAt: enrollments.startedAt,
      trialAttendedAt: enrollments.trialAttendedAt,
      enrollmentEndedAt: enrollments.endedAt,
      pauseStartedAt: enrollments.pauseStartedAt,
      pauseEndedAt: enrollments.pauseEndedAt,
    })
    .from(enrollments)
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .where(
      and(
        eq(enrollments.studentId, params.studentId),
        isNull(enrollments.endedAt),
      ),
    );

  const matchesLevel = levelRows.some(
    (r) =>
      isEnrollmentActiveOnDate({
        sessionDate: row.session.scheduledDate,
        enrollmentStartedAt: r.enrollmentStartedAt,
        studentStartDate: studentRow?.startDate,
        enrollmentEndedAt: r.enrollmentEndedAt,
        pauseStartedAt: r.pauseStartedAt,
        pauseEndedAt: r.pauseEndedAt,
        trialAttendedAt: r.trialAttendedAt,
      }) && sameProgrammeLevel(row.class, r.class),
  );
  if (!matchesLevel) {
    throw new Error(
      `Student must be enrolled in a ${programmeTypeLabel(row.class)} class.`,
    );
  }

  const detail = await loadSessionDetail(params.sessionId);
  if (!detail) throw new Error("Session not found.");
  if (detail.students.some((s) => s.student.id === params.studentId)) {
    throw new Error("Student is already on the attendance list.");
  }

  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.sessionId, params.sessionId),
        eq(attendanceRecords.studentId, params.studentId),
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
        status: "absent_pending",
        makeupNote: WALK_IN_NOTE,
        updatedBy: "",
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, existing.id));
  } else {
    await db.insert(attendanceRecords).values({
      sessionId: params.sessionId,
      studentId: params.studentId,
      status: "absent_pending",
      makeupNote: WALK_IN_NOTE,
      updatedBy: "",
    });
  }

  await writeAuditLog({
    actor: params.actor,
    action: "add_walk_in_student",
    entityType: "attendance",
    entityId: `${params.sessionId}:${params.studentId}`,
    before,
    after: { status: "absent_pending", makeupNote: WALK_IN_NOTE },
  });

  return { studentId: params.studentId, name: student.name };
}
