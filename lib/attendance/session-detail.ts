import type { AttendanceStatus } from "@/lib/attendance/status";
import { getDb } from "@/lib/db/index";
import {
  attendanceRecords,
  classSessions,
  classes,
  enrollments,
  students,
} from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

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
        isNull(enrollments.endedAt),
        isNull(students.archivedAt),
      ),
    );

  const existing = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.sessionId, sessionId));

  const byStudent = new Map(existing.map((r) => [r.studentId, r]));

  const defaultStatus: AttendanceStatus = "absent_pending";
  const studentsWithAttendance = roster.map(({ student, enrollment }) => {
    const record = byStudent.get(student.id);
    return {
      student,
      enrollment,
      record: record ?? null,
      status: (record?.status ?? defaultStatus) as AttendanceStatus,
      makeupNote: record?.makeupNote ?? "",
    };
  });

  return {
    session: session.session,
    class: session.class,
    students: studentsWithAttendance,
  };
}

export async function ensureAttendanceRows(sessionId: string, classId: string) {
  const db = getDb();
  const detail = await loadSessionDetail(sessionId);
  if (!detail) return;

  for (const row of detail.students) {
    if (row.record) continue;
    await db.insert(attendanceRecords).values({
      sessionId,
      studentId: row.student.id,
      status: row.enrollment.freeTrial ? "free_trial" : "absent_pending",
      updatedBy: "system",
    });
  }
}
