import { getDb } from "@/lib/db/index";
import {
  attendanceRecords,
  enrollments,
  students,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type StudentDeleteSummary = {
  studentId: string;
  studentName: string;
  enrollmentCount: number;
  attendanceCount: number;
};

export async function deleteStudentPermanently(
  studentId: string,
): Promise<StudentDeleteSummary> {
  const db = getDb();

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!student) {
    throw new Error("Student not found.");
  }

  const enrollmentRows = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(eq(enrollments.studentId, studentId));

  const attendanceRows = await db
    .select({ id: attendanceRecords.id })
    .from(attendanceRecords)
    .where(eq(attendanceRecords.studentId, studentId));

  await db.delete(students).where(eq(students.id, studentId));

  return {
    studentId,
    studentName: student.name,
    enrollmentCount: enrollmentRows.length,
    attendanceCount: attendanceRows.length,
  };
}
