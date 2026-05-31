import type { ConsolidatableSessionRow } from "@/lib/attendance/merge-consolidated-sessions";
import {
  computeConsolidatedSlotHeadcount,
  type SessionAttendanceRecord,
} from "@/lib/attendance/session-headcount";
import {
  formatAttendanceMarkLabel,
  formatSessionExpectedLabel,
} from "@/lib/attendance/session-expected-labels";
import { loadMakeupBookingsByStudent } from "@/lib/attendance/session-roster-visibility";
import { pickCanonicalSessionRow } from "@/lib/attendance/session-slot-matching";
import type { AttendanceStatus } from "@/lib/attendance/status";
import {
  loadClassRosterRows,
  rosterForClassOnDate,
} from "@/lib/enrollments/roster-query";
import { getDb } from "@/lib/db/index";
import { attendanceRecords } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

/**
 * Peer-class slots share one list row: only the host class roster counts as regular;
 * M/U students appear via attendance on any merged session (e.g. Kester on 25/05).
 */
export async function computeConsolidatedSlotMetrics<
  T extends ConsolidatableSessionRow,
>(group: T[]): Promise<{
  expected: ConsolidatableSessionRow["expected"];
  expectedLabel: string;
  waivedCount: number;
  studentsToMarkCount: number;
  savedCount: number;
  attendanceMarked: boolean;
  attendanceMarkLabel: string;
}> {
  const db = getDb();
  const primary = pickCanonicalSessionRow(group);
  const sessionIds = group.map((r) => r.session.id);
  const sessionDate = primary.session.scheduledDate;

  const rosterRows = await loadClassRosterRows([primary.class.id]);
  const primaryRoster = rosterForClassOnDate(
    rosterRows,
    primary.class.id,
    sessionDate,
  );

  const statusRows = await db
    .select({
      sessionId: attendanceRecords.sessionId,
      studentId: attendanceRecords.studentId,
      status: attendanceRecords.status,
      updatedBy: attendanceRecords.updatedBy,
      makeupNote: attendanceRecords.makeupNote,
    })
    .from(attendanceRecords)
    .where(inArray(attendanceRecords.sessionId, sessionIds));

  const recordsBySession = new Map<
    string,
    Map<string, SessionAttendanceRecord>
  >();
  const waiveCountByStudent = new Set<string>();

  for (const row of statusRows) {
    const sessionRecords =
      recordsBySession.get(row.sessionId) ?? new Map();
    sessionRecords.set(row.studentId, {
      status: row.status as AttendanceStatus,
      updatedBy: row.updatedBy,
      makeupNote: row.makeupNote ?? "",
    });
    recordsBySession.set(row.sessionId, sessionRecords);
    if (row.status === "waive") waiveCountByStudent.add(row.studentId);
  }

  const bookingStudentIds = [
    ...new Set([
      ...primaryRoster.map((r) => r.studentId),
      ...statusRows.map((r) => r.studentId),
    ]),
  ];
  const bookingsByStudent = await loadMakeupBookingsByStudent(
    bookingStudentIds,
  );

  const { expected, studentsToMark, savedCount } = computeConsolidatedSlotHeadcount(
    {
      sessionDate,
      primarySessionId: primary.session.id,
      primaryRoster,
      recordsBySession,
      bookingsByStudent,
    },
  );

  const studentsToMarkCount = studentsToMark.length;
  const waivedCount = waiveCountByStudent.size;
  const attendanceMarked =
    studentsToMarkCount === 0
      ? waivedCount > 0
      : savedCount >= studentsToMarkCount;

  return {
    expected,
    expectedLabel: formatSessionExpectedLabel(
      expected,
      waiveCountByStudent.size,
    ),
    waivedCount,
    studentsToMarkCount,
    savedCount,
    attendanceMarked,
    attendanceMarkLabel: formatAttendanceMarkLabel(
      attendanceMarked,
      studentsToMarkCount,
      savedCount,
      waivedCount,
    ),
  };
}
