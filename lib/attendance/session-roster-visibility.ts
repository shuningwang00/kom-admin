import { getDb } from "@/lib/db/index";
import { attendanceRecords, classSessions } from "@/lib/db/schema";
import { and, eq, gte, inArray } from "drizzle-orm";

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

/** Load makeup_scheduled bookings across all students, from 20 days ago onwards. */
export async function loadAllMakeupBookings(): Promise<Map<string, MakeupBooking[]>> {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 20);
  const fromDate = cutoff.toISOString().slice(0, 10);
  const bookingRows = await db
    .select({
      studentId: attendanceRecords.studentId,
      sessionId: classSessions.id,
      scheduledDate: classSessions.scheduledDate,
      makeupNote: attendanceRecords.makeupNote,
    })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(attendanceRecords.sessionId, classSessions.id))
    .where(
      and(
        eq(attendanceRecords.status, "makeup_scheduled"),
        gte(classSessions.scheduledDate, fromDate),
      ),
    );

  const bookingsByStudent = new Map<string, MakeupBooking[]>();
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
