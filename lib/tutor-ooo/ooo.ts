import { attachExpectedAttendance } from "@/lib/attendance/expected-counts";
import { sessionActiveExpectedTotal } from "@/lib/attendance/relief-tutor-session";
import { RELIEF_TUTOR_NEEDED_VALUE } from "@/lib/tutors/constants";
import { getDb } from "@/lib/db/index";
import { classSessions, classes, tutorOoo } from "@/lib/db/schema";
import { and, eq, gte, inArray, lte } from "drizzle-orm";

export async function createTutorOoo(params: {
  tutorMatch: string;
  startDate: string;
  endDate: string;
  reason: string;
  createdBy: string;
}) {
  const db = getDb();
  const [ooo] = await db.insert(tutorOoo).values(params).returning();

  const tutorClasses = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.tutor, params.tutorMatch), eq(classes.isActive, true)));

  if (tutorClasses.length > 0) {
    const classIds = tutorClasses.map((c) => c.id);
    const sessions = await db
      .select({
        session: classSessions,
        class: classes,
      })
      .from(classSessions)
      .innerJoin(classes, eq(classSessions.classId, classes.id))
      .where(
        and(
          inArray(classSessions.classId, classIds),
          gte(classSessions.scheduledDate, params.startDate),
          lte(classSessions.scheduledDate, params.endDate),
        ),
      );

    const unassigned = sessions.filter(
      (row) => !row.session.reliefTutor.trim(),
    );
    const withExpected = await attachExpectedAttendance(
      unassigned.map((row) => ({
        session: row.session,
        class: row.class,
      })),
    );
    const toFlag = withExpected
      .filter((row) => sessionActiveExpectedTotal(row.expected) > 0)
      .map((row) => row.session.id);
    if (toFlag.length > 0) {
      await db
        .update(classSessions)
        .set({ reliefTutor: RELIEF_TUTOR_NEEDED_VALUE, updatedAt: new Date() })
        .where(inArray(classSessions.id, toFlag));
    }
  }

  return ooo;
}

export async function updateTutorOoo(
  id: string,
  params: { startDate: string; endDate: string; reason: string },
) {
  const db = getDb();
  const [row] = await db
    .update(tutorOoo)
    .set({
      startDate: params.startDate,
      endDate: params.endDate,
      reason: params.reason,
    })
    .where(eq(tutorOoo.id, id))
    .returning();
  return row ?? null;
}

export async function deleteTutorOoo(id: string) {
  const db = getDb();
  const [deleted] = await db
    .delete(tutorOoo)
    .where(eq(tutorOoo.id, id))
    .returning();
  return deleted ?? null;
}

export async function listTutorOoo(filter?: { tutorMatch?: string }) {
  const db = getDb();
  const where =
    filter?.tutorMatch ? eq(tutorOoo.tutorMatch, filter.tutorMatch) : undefined;
  return db.select().from(tutorOoo).where(where).orderBy(tutorOoo.startDate);
}

export async function listActiveTutors(): Promise<string[]> {
  const { listTutorOptions } = await import("@/lib/tutors/options");
  return listTutorOptions();
}
