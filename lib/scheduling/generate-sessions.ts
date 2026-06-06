import { getDb } from "@/lib/db/index";
import { classSessions, classes, enrollments, trialLeads } from "@/lib/db/schema";
import { canonicalTimeLabel } from "@/lib/scheduling/time-slots";
import { datesForWeekdayInMonth, parseYearMonth } from "@/lib/scheduling/weekday-dates";
import { and, eq, inArray, isNull, or } from "drizzle-orm";

export type GenerateSessionsResult = {
  yearMonth: string;
  created: number;
  skipped: number;
};

/**
 * Creates one session row per class per calendar date (weekday schedule).
 * Which students appear on each session is decided at attendance time from
 * registration start, enrollment startedAt, withdrawal, and pause dates —
 * not when sessions are generated (paused students are excluded for those dates).
 */
async function sessionExists(
  db: ReturnType<typeof getDb>,
  classId: string,
  scheduledDate: string,
): Promise<boolean> {
  // Also treat the date as "occupied" if an existing session was rescheduled FROM it —
  // otherwise re-running generation after a reschedule would create a duplicate for the vacated slot.
  const rows = await db
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.classId, classId),
        or(
          eq(classSessions.scheduledDate, scheduledDate),
          eq(classSessions.originalDate, scheduledDate),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function generateSessionsForMonth(
  yearMonth: string,
  classId?: string,
): Promise<GenerateSessionsResult> {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) throw new Error("Use yearMonth format YYYY-MM");

  const startDate = `${yearMonth}-01`;
  const lastDay = new Date(parsed.year, parsed.month, 0).getDate();
  const endDate = `${yearMonth}-${String(lastDay).padStart(2, "0")}`;

  const db = getDb();

  // Active classes: generate for all weekday occurrences in the month
  const activeClasses = await db
    .select()
    .from(classes)
    .where(and(eq(classes.isActive, true), classId ? eq(classes.id, classId) : undefined));

  // Inactive classes that have active trials in this month: generate only for the trial date
  const trialRows = await db
    .select({ classId: trialLeads.classId, trialDate: trialLeads.trialDate })
    .from(trialLeads)
    .where(
      and(
        eq(trialLeads.status, "active"),
        and(
          // trialDate >= startDate AND trialDate <= endDate
          // Drizzle doesn't have gte/lte for date columns directly but they work via sql
          inArray(trialLeads.classId,
            db
              .select({ id: classes.id })
              .from(classes)
              .where(eq(classes.isActive, false))
          ),
        ),
      ),
    );

  // Build map: inactive classId -> Set<trialDate> for this month
  const inactiveTrialDates = new Map<string, Set<string>>();
  for (const row of trialRows) {
    if (!row.classId || !row.trialDate) continue;
    if (row.trialDate < startDate || row.trialDate > endDate) continue;
    if (!inactiveTrialDates.has(row.classId)) {
      inactiveTrialDates.set(row.classId, new Set());
    }
    inactiveTrialDates.get(row.classId)!.add(row.trialDate);
  }

  let created = 0;
  let skipped = 0;

  // Generate for active classes (all weekday occurrences)
  for (const cls of activeClasses) {
    const dates = datesForWeekdayInMonth(parsed.year, parsed.month, cls.weekday);
    for (const scheduledDate of dates) {
      if (await sessionExists(db, cls.id, scheduledDate)) {
        skipped += 1;
        continue;
      }
      await db.insert(classSessions).values({
        classId: cls.id,
        scheduledDate,
        timeLabel: canonicalTimeLabel(cls.time),
      });
      created += 1;
    }
  }

  // Generate for inactive classes that have a trial this month (trial date only)
  if (inactiveTrialDates.size > 0) {
    const inactiveClassIds = [...inactiveTrialDates.keys()];
    const inactiveClassRows = await db
      .select()
      .from(classes)
      .where(inArray(classes.id, inactiveClassIds));

    for (const cls of inactiveClassRows) {
      const dates = inactiveTrialDates.get(cls.id) ?? new Set<string>();
      for (const scheduledDate of dates) {
        if (await sessionExists(db, cls.id, scheduledDate)) {
          skipped += 1;
          continue;
        }
        await db.insert(classSessions).values({
          classId: cls.id,
          scheduledDate,
          timeLabel: canonicalTimeLabel(cls.time),
        });
        created += 1;
      }
    }
  }

  return { yearMonth, created, skipped };
}
