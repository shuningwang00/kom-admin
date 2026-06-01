import type { getDb } from "@/lib/db/index";
import { classSessions } from "@/lib/db/schema";
import { formatShortDate } from "@/lib/attendance/makeup-display";
import { parseTimeRange } from "@/lib/scheduling/time-slots";
import { and, eq, inArray, ne } from "drizzle-orm";

function timesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Block only if there is an existing session for the same class on the same date
 *  whose time window overlaps the new time. Different time = fine. */
export async function assertRescheduleDateAvailable(
  db: ReturnType<typeof getDb>,
  classId: string,
  sessionId: string,
  newDate: string,
  newTimeLabel: string,
): Promise<void> {
  const existing = await db
    .select({ id: classSessions.id, timeLabel: classSessions.timeLabel })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.classId, classId),
        eq(classSessions.scheduledDate, newDate),
        ne(classSessions.id, sessionId),
        inArray(classSessions.status, ["scheduled", "cancelled"]),
      ),
    );

  if (existing.length === 0) return;

  const newRange = parseTimeRange(newTimeLabel);

  for (const session of existing) {
    const existingRange = parseTimeRange(session.timeLabel);

    if (newRange && existingRange) {
      if (
        timesOverlap(
          newRange.startMinutes,
          newRange.endMinutes,
          existingRange.startMinutes,
          existingRange.endMinutes,
        )
      ) {
        throw new Error(
          `There is already a session on ${formatShortDate(newDate)} at ${existingRange.timeLabel}. Choose a different time.`,
        );
      }
    } else {
      // Can't parse one or both times — fall back to blocking to be safe
      throw new Error(
        `There is already a session on ${formatShortDate(newDate)}. Choose a different time or date.`,
      );
    }
  }
}
