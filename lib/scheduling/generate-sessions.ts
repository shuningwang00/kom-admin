import { getDb } from "@/lib/db/index";
import { classSessions, classes } from "@/lib/db/schema";
import { datesForWeekdayInMonth, parseYearMonth } from "@/lib/scheduling/weekday-dates";
import { eq } from "drizzle-orm";

export type GenerateSessionsResult = {
  yearMonth: string;
  created: number;
  skipped: number;
};

export async function generateSessionsForMonth(
  yearMonth: string,
): Promise<GenerateSessionsResult> {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) throw new Error("Use yearMonth format YYYY-MM");

  const db = getDb();
  const activeClasses = await db
    .select()
    .from(classes)
    .where(eq(classes.isActive, true));

  let created = 0;
  let skipped = 0;

  for (const cls of activeClasses) {
    const dates = datesForWeekdayInMonth(
      parsed.year,
      parsed.month,
      cls.weekday,
    );
    for (const scheduledDate of dates) {
      const inserted = await db
        .insert(classSessions)
        .values({
          classId: cls.id,
          scheduledDate,
          timeLabel: cls.time,
        })
        .onConflictDoNothing({
          target: [classSessions.classId, classSessions.scheduledDate],
        })
        .returning({ id: classSessions.id });
      if (inserted.length) created += 1;
      else skipped += 1;
    }
  }

  return { yearMonth, created, skipped };
}
