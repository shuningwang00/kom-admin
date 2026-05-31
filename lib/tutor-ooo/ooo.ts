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
      .select({ id: classSessions.id, reliefTutor: classSessions.reliefTutor })
      .from(classSessions)
      .where(
        and(
          inArray(classSessions.classId, classIds),
          gte(classSessions.scheduledDate, params.startDate),
          lte(classSessions.scheduledDate, params.endDate),
        ),
      );

    const toFlag = sessions.filter((s) => !s.reliefTutor.trim()).map((s) => s.id);
    if (toFlag.length > 0) {
      await db
        .update(classSessions)
        .set({ reliefTutor: RELIEF_TUTOR_NEEDED_VALUE, updatedAt: new Date() })
        .where(inArray(classSessions.id, toFlag));
    }
  }

  return ooo;
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
  const db = getDb();
  const rows = await db
    .selectDistinct({ tutor: classes.tutor })
    .from(classes)
    .where(and(eq(classes.isActive, true)));
  return rows
    .map((r) => r.tutor.trim())
    .filter(Boolean)
    .sort();
}
