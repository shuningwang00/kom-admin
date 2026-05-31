import { copyTrialAttendanceToStudent } from "@/lib/attendance/trial-lead-attendance";
import type { getDb } from "@/lib/db/index";
import { enrollments, students, trialLeads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Db = ReturnType<typeof getDb>;

export type TrialLeadRow = typeof trialLeads.$inferSelect;

export async function convertTrialLead(
  db: Db,
  trial: TrialLeadRow,
  opts: {
    startDate?: string | null;
    registrationFeeDue?: boolean;
    classId?: string | null;
  },
) {
  if (trial.status !== "active") {
    throw new Error("This trial has already been converted.");
  }

  const classId = (opts.classId ?? trial.classId ?? "").trim();
  if (!classId) {
    throw new Error("Class is required to enroll as a full-time student.");
  }

  const trialLessonDate = trial.trialDate?.trim() ?? null;
  const startDate =
    opts.startDate != null && String(opts.startDate).trim()
      ? String(opts.startDate).trim()
      : trialLessonDate;

  const [student] = await db
    .insert(students)
    .values({
      name: trial.name,
      primaryContact: trial.primaryContact,
      primaryContactType: trial.primaryContactType,
      secondaryContact: trial.secondaryContact,
      secondaryContactType: trial.secondaryContactType,
      school: trial.school,
      parentName: trial.parentName,
      startDate,
      notes: trial.notes,
    })
    .returning();

  await db.insert(enrollments).values({
    studentId: student.id,
    classId,
    startedAt: startDate,
    trialAttendedAt: trialLessonDate,
    freeTrial: true,
    registrationFeeDue: Boolean(opts.registrationFeeDue),
  });

  await copyTrialAttendanceToStudent(db, trial, student.id);

  const [updated] = await db
    .update(trialLeads)
    .set({
      status: "converted",
      convertedStudentId: student.id,
      updatedAt: new Date(),
    })
    .where(eq(trialLeads.id, trial.id))
    .returning();

  return { student, trial: updated };
}
