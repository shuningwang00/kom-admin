import { getDb } from "@/lib/db/index";
import { classSessions, classes } from "@/lib/db/schema";
import { canonicalTimeLabel } from "@/lib/scheduling/time-slots";
import { eq } from "drizzle-orm";

/** One-off or maintenance: align DB strings to canonical `6:15pm – 8pm` form. */
export async function normalizeAllStoredTimeLabelsInDb(): Promise<{
  classesUpdated: number;
  sessionsUpdated: number;
}> {
  const db = getDb();
  let classesUpdated = 0;
  let sessionsUpdated = 0;

  for (const row of await db.select().from(classes)) {
    const canon = canonicalTimeLabel(row.time);
    if (canon && canon !== row.time) {
      await db
        .update(classes)
        .set({ time: canon, updatedAt: new Date() })
        .where(eq(classes.id, row.id));
      classesUpdated += 1;
    }
  }

  for (const row of await db.select().from(classSessions)) {
    const canon = canonicalTimeLabel(row.timeLabel);
    if (canon && canon !== row.timeLabel) {
      await db
        .update(classSessions)
        .set({ timeLabel: canon, updatedAt: new Date() })
        .where(eq(classSessions.id, row.id));
      sessionsUpdated += 1;
    }
  }

  return { classesUpdated, sessionsUpdated };
}
