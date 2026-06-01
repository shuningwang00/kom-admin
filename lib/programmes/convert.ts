import type { getDb } from "@/lib/db/index";
import {
  enrollments,
  holidayProgrammeParticipants,
  students,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Db = ReturnType<typeof getDb>;

export type ParticipantRow =
  typeof holidayProgrammeParticipants.$inferSelect;

export async function convertProgrammeParticipant(
  db: Db,
  participant: ParticipantRow,
  opts: {
    startDate?: string | null;
    classId?: string | null;
    registrationFeeDue?: boolean;
  },
) {
  if (participant.status !== "active") {
    throw new Error("This participant has already been converted.");
  }
  if (participant.studentId) {
    throw new Error("This participant is already an existing student.");
  }

  const name = participant.name.trim();
  if (!name) {
    throw new Error("Participant has no name.");
  }

  const startDate =
    opts.startDate != null && String(opts.startDate).trim()
      ? String(opts.startDate).trim()
      : null;

  const [student] = await db
    .insert(students)
    .values({
      name,
      primaryContact: participant.primaryContact,
      primaryContactType: participant.primaryContactType,
      secondaryContact: participant.secondaryContact,
      secondaryContactType: participant.secondaryContactType,
      school: participant.school,
      parentName: participant.parentName,
      startDate,
      notes: participant.notes,
    })
    .returning();

  const classId = (opts.classId ?? "").trim();
  if (classId) {
    await db.insert(enrollments).values({
      studentId: student.id,
      classId,
      startedAt: startDate,
      registrationFeeDue: Boolean(opts.registrationFeeDue),
    });
  }

  const [updated] = await db
    .update(holidayProgrammeParticipants)
    .set({
      status: "converted",
      convertedStudentId: student.id,
      updatedAt: new Date(),
    })
    .where(eq(holidayProgrammeParticipants.id, participant.id))
    .returning();

  return { student, participant: updated };
}
