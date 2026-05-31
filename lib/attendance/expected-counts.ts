import { isSessionAttendanceSaved } from "@/lib/attendance/attendance-saved";
import {
  computeSessionHeadcount,
  type SessionAttendanceRecord,
} from "@/lib/attendance/session-headcount";
import {
  formatAttendanceMarkLabel,
  formatExpectedAttendancePreview,
  formatSessionExpectedLabel,
  type SessionExpectedCounts,
} from "@/lib/attendance/session-expected-labels";
import { loadMakeupBookingsByStudent } from "@/lib/attendance/session-roster-visibility";
import type { AttendanceStatus } from "@/lib/attendance/status";
import {
  loadClassRosterRows,
  rosterForClassOnDate,
} from "@/lib/enrollments/roster-query";
import { getDb } from "@/lib/db/index";
import { attendanceRecords } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

export type SessionRowInput = {
  session: { id: string; scheduledDate: string };
  class: { id: string };
};

export type SessionRowWithExpected<T extends SessionRowInput> = T & {
  expected: SessionExpectedCounts;
  expectedLabel: string;
  waivedCount: number;
  studentsToMarkCount: number;
  savedCount: number;
  attendanceMarked: boolean;
  attendanceMarkLabel: string;
};

export async function attachExpectedAttendance<T extends SessionRowInput>(
  rows: T[],
): Promise<SessionRowWithExpected<T>[]> {
  if (rows.length === 0) return [];

  const db = getDb();
  const classIds = [...new Set(rows.map((r) => r.class.id))];
  const sessionIds = rows.map((r) => r.session.id);

  const rosterRows = await loadClassRosterRows(classIds);

  const rosterStudentIds = [...new Set(rosterRows.map((r) => r.studentId))];

  const bookingsByStudent = await loadMakeupBookingsByStudent(
    rosterStudentIds,
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

  const waiveBySession = new Map<string, Set<string>>();
  const recordsBySession = new Map<
    string,
    Map<
      string,
      {
        status: AttendanceStatus;
        updatedBy: string;
        makeupNote: string;
      }
    >
  >();

  for (const row of statusRows) {
    const sessionRecords =
      recordsBySession.get(row.sessionId) ?? new Map();
    sessionRecords.set(row.studentId, {
      status: row.status as AttendanceStatus,
      makeupNote: row.makeupNote ?? "",
      updatedBy: row.updatedBy,
    });
    recordsBySession.set(row.sessionId, sessionRecords);

    if (row.status === "waive") {
      const set = waiveBySession.get(row.sessionId) ?? new Set();
      set.add(row.studentId);
      waiveBySession.set(row.sessionId, set);
    }
  }

  return rows.map((row) => {
    const roster = rosterForClassOnDate(
      rosterRows,
      row.class.id,
      row.session.scheduledDate,
    );
    const waiveOnSession = waiveBySession.get(row.session.id) ?? new Set();
    const sessionRecords = recordsBySession.get(row.session.id) ?? new Map();
    const headcount = computeSessionHeadcount({
      sessionId: row.session.id,
      sessionDate: row.session.scheduledDate,
      roster,
      sessionRecords: sessionRecords as Map<string, SessionAttendanceRecord>,
      waiveOnSession,
      bookingsByStudent,
    });
    const { expected, studentsToMark, savedCount } = headcount;

    const waivedCount = waiveOnSession.size;
    const attendanceMarked =
      studentsToMark.length === 0
        ? waivedCount > 0
        : studentsToMark.every((studentId) =>
            isSessionAttendanceSaved(sessionRecords.get(studentId)),
          );

    return {
      ...row,
      expected,
      expectedLabel: formatSessionExpectedLabel(expected, waivedCount),
      waivedCount,
      studentsToMarkCount: studentsToMark.length,
      savedCount,
      attendanceMarked,
      attendanceMarkLabel: formatAttendanceMarkLabel(
        attendanceMarked,
        studentsToMark.length,
        savedCount,
        waivedCount,
      ),
    };
  });
}
