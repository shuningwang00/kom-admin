import { getDb } from "@/lib/db/index";
import { attendanceRecords, classSessions } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export type { MakeupBooking } from "@/lib/attendance/makeup-session-rules";
export {
  isAwayForMakeupOnAnotherSession,
  isHiddenFromSessionAttendance,
  isMakeupLessonSession,
  isMissedLessonWithScheduledMakeup,
} from "@/lib/attendance/makeup-session-rules";

import type { MakeupBooking } from "@/lib/attendance/makeup-session-rules";

export async function loadMakeupBookingsByStudent(
  studentIds: string[],
): Promise<Map<string, MakeupBooking[]>> {
  const bookingsByStudent = new Map<string, MakeupBooking[]>();
  if (studentIds.length === 0) return bookingsByStudent;

  const db = getDb();
  const bookingRows = await db
    .select({
      studentId: attendanceRecords.studentId,
      sessionId: classSessions.id,
      scheduledDate: classSessions.scheduledDate,
      makeupNote: attendanceRecords.makeupNote,
    })
    .from(attendanceRecords)
    .innerJoin(
      classSessions,
      eq(attendanceRecords.sessionId, classSessions.id),
    )
    .where(
      and(
        inArray(attendanceRecords.studentId, studentIds),
        eq(attendanceRecords.status, "makeup_scheduled"),
      ),
    );

  for (const row of bookingRows) {
    const list = bookingsByStudent.get(row.studentId) ?? [];
    list.push({
      sessionId: row.sessionId,
      scheduledDate: row.scheduledDate,
      makeupNote: row.makeupNote ?? "",
    });
    bookingsByStudent.set(row.studentId, list);
  }

  return bookingsByStudent;
}
