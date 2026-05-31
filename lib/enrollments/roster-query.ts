import { filterRosterForSessionDate } from "@/lib/enrollments/eligibility";
import { getDb } from "@/lib/db/index";
import { enrollments, students } from "@/lib/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";

export async function loadClassRosterRows(classIds: string[]) {
  if (classIds.length === 0) return [];

  const db = getDb();
  return db
    .select({
      classId: enrollments.classId,
      studentId: enrollments.studentId,
      freeTrial: enrollments.freeTrial,
      enrollmentStartedAt: enrollments.startedAt,
      trialAttendedAt: enrollments.trialAttendedAt,
      enrollmentEndedAt: enrollments.endedAt,
      pauseStartedAt: enrollments.pauseStartedAt,
      pauseEndedAt: enrollments.pauseEndedAt,
      studentStartDate: students.startDate,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(
      and(inArray(enrollments.classId, classIds), isNull(students.archivedAt)),
    );
}

export function rosterForClassOnDate(
  rows: Awaited<ReturnType<typeof loadClassRosterRows>>,
  classId: string,
  sessionDate: string,
) {
  return filterRosterForSessionDate(
    rows.filter((r) => r.classId === classId),
    sessionDate,
  ).map(({ studentId, freeTrial, trialAttendedAt }) => ({
    studentId,
    freeTrial,
    trialAttendedAt,
  }));
}
