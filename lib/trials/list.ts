import { getDb } from "@/lib/db/index";
import { enrollments, students, trialLeads } from "@/lib/db/schema";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

export type TrialListRow = typeof trialLeads.$inferSelect & {
  /** True when the trial date was set on Enrollments, not via Trials → Convert. */
  fromEnrollment?: boolean;
  /** Full-time registration start (after convert or from Enrollments). */
  startDate?: string | null;
};

function resolveStartDate(
  enrollmentStartedAt: string | null | undefined,
  studentStartDate: string | null | undefined,
): string | null {
  return enrollmentStartedAt?.trim() || studentStartDate?.trim() || null;
}

const ENROLLMENT_TRIAL_ID_PREFIX = "enrollment-";

export function isEnrollmentTrialListId(id: string): boolean {
  return id.startsWith(ENROLLMENT_TRIAL_ID_PREFIX);
}

async function listConvertedFromEnrollments(
  db: ReturnType<typeof getDb>,
): Promise<TrialListRow[]> {
  const linkedStudentIds = await db
    .select({ studentId: trialLeads.convertedStudentId })
    .from(trialLeads)
    .where(eq(trialLeads.status, "converted"));

  const skipStudents = new Set(
    linkedStudentIds
      .map((r) => r.studentId)
      .filter((id): id is string => Boolean(id)),
  );

  const rows = await db
    .select({
      enrollment: enrollments,
      student: students,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(
      and(
        isNotNull(enrollments.trialAttendedAt),
        isNull(students.archivedAt),
      ),
    )
    .orderBy(asc(students.name));

  const now = new Date();
  const synthetic: TrialListRow[] = [];

  for (const { enrollment, student } of rows) {
    if (skipStudents.has(student.id)) continue;

    synthetic.push({
      id: `${ENROLLMENT_TRIAL_ID_PREFIX}${enrollment.id}`,
      name: student.name,
      primaryContact: student.primaryContact,
      primaryContactType: student.primaryContactType,
      secondaryContact: student.secondaryContact,
      secondaryContactType: student.secondaryContactType,
      school: student.school,
      parentName: student.parentName,
      classId: enrollment.classId,
      trialDate: enrollment.trialAttendedAt,
      trialAttendanceStatus: null,
      trialAttendanceUpdatedBy: "",
      notes: student.notes,
      status: "converted",
      convertedStudentId: student.id,
      createdAt: student.createdAt,
      updatedAt: now,
      fromEnrollment: true,
      startDate: resolveStartDate(enrollment.startedAt, student.startDate),
    });
  }

  return synthetic;
}

export async function listTrialsByStatus(
  status: "active" | "converted",
): Promise<TrialListRow[]> {
  const db = getDb();

  if (status === "active") {
    return db
      .select()
      .from(trialLeads)
      .where(eq(trialLeads.status, "active"))
      .orderBy(asc(trialLeads.name));
  }

  const convertedRows = await db
    .select({
      trial: trialLeads,
      studentStartDate: students.startDate,
      enrollmentStartedAt: enrollments.startedAt,
    })
    .from(trialLeads)
    .leftJoin(students, eq(trialLeads.convertedStudentId, students.id))
    .leftJoin(
      enrollments,
      and(
        eq(enrollments.studentId, students.id),
        eq(enrollments.classId, trialLeads.classId),
      ),
    )
    .where(eq(trialLeads.status, "converted"))
    .orderBy(asc(trialLeads.name));

  const convertedLeads: TrialListRow[] = convertedRows.map(
    ({ trial, studentStartDate, enrollmentStartedAt }) => ({
      ...trial,
      startDate: resolveStartDate(enrollmentStartedAt, studentStartDate),
    }),
  );

  const fromEnrollments = await listConvertedFromEnrollments(db);

  return [...convertedLeads, ...fromEnrollments].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
