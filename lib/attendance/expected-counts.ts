import { isSessionAttendanceSaved } from "@/lib/attendance/attendance-saved";
import { computeCancelledSessionHeadcount } from "@/lib/attendance/cancel-session";
import {
  computeSessionHeadcount,
  type SessionAttendanceRecord,
} from "@/lib/attendance/session-headcount";
import {
  formatAttendanceMarkLabel,
  formatSessionExpectedLabel,
  type SessionExpectedCounts,
} from "@/lib/attendance/session-expected-labels";
import {
  loadAllMakeupBookings,
  loadMakeupBookingsByStudent,
} from "@/lib/attendance/session-roster-visibility";
import type { AttendanceStatus } from "@/lib/attendance/status";
import {
  loadClassRosterRows,
  rosterForClassOnDate,
} from "@/lib/enrollments/roster-query";
import { getDb } from "@/lib/db/index";
import { attendanceRecords, trialLeads } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export type SessionRowInput = {
  session: { id: string; scheduledDate: string; status?: string; rescheduleNote?: string | null };
  class: { id: string };
};

export type SessionRowWithExpected<T extends SessionRowInput> = T & {
  expected: SessionExpectedCounts;
  expectedLabel: string;
  waivedCount: number;
  /** Active enrollments on this date before waive/hide filtering. */
  rosterSize: number;
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

  const [rosterRows, statusRows, bookingsByStudent, trialLeadRows] = await Promise.all([
    loadClassRosterRows(classIds),
    db
      .select({
        sessionId: attendanceRecords.sessionId,
        studentId: attendanceRecords.studentId,
        status: attendanceRecords.status,
        updatedBy: attendanceRecords.updatedBy,
        makeupNote: attendanceRecords.makeupNote,
      })
      .from(attendanceRecords)
      .where(inArray(attendanceRecords.sessionId, sessionIds)),
    loadAllMakeupBookings(),
    db
      .select({
        id: trialLeads.id,
        classId: trialLeads.classId,
        trialDate: trialLeads.trialDate,
        trialAttendanceStatus: trialLeads.trialAttendanceStatus,
        trialAttendanceUpdatedBy: trialLeads.trialAttendanceUpdatedBy,
      })
      .from(trialLeads)
      .where(
        and(
          inArray(trialLeads.classId, classIds),
          eq(trialLeads.status, "active"),
        ),
      ),
  ]);

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

  // Build trial lead lookups: classId:date → entries, and id → saved
  type TrialLeadEntry = { id: string; attendanceSaved: boolean };
  const trialLeadsByClassDate = new Map<string, TrialLeadEntry[]>();
  const trialLeadSavedById = new Map<string, boolean>();
  for (const t of trialLeadRows) {
    if (!t.classId || !t.trialDate) continue;
    const saved = t.trialAttendanceStatus
      ? isSessionAttendanceSaved({
          status: t.trialAttendanceStatus,
          updatedBy: t.trialAttendanceUpdatedBy,
        })
      : false;
    const key = `${t.classId}:${t.trialDate}`;
    const list = trialLeadsByClassDate.get(key) ?? [];
    list.push({ id: t.id, attendanceSaved: saved });
    trialLeadsByClassDate.set(key, list);
    trialLeadSavedById.set(t.id, saved);
  }

  return rows.map((row) => {
    const isCustomMakeupSession = row.session.rescheduleNote === "Makeup session";
    const roster = isCustomMakeupSession ? [] : rosterForClassOnDate(
      rosterRows,
      row.class.id,
      row.session.scheduledDate,
    );
    const waiveOnSession = waiveBySession.get(row.session.id) ?? new Set();
    const sessionRecords = recordsBySession.get(row.session.id) ?? new Map();
    const isCancelled = row.session.status === "cancelled";
    const headcount = isCancelled
      ? computeCancelledSessionHeadcount(roster, sessionRecords)
      : computeSessionHeadcount({
          sessionId: row.session.id,
          sessionDate: row.session.scheduledDate,
          roster,
          sessionRecords: sessionRecords as Map<string, SessionAttendanceRecord>,
          waiveOnSession,
          bookingsByStudent,
        });
    const { expected, studentsToMark } = headcount;
    let savedCount = headcount.savedCount;

    // Fold active trial leads into expected counts for non-cancelled sessions
    if (!isCancelled) {
      const sessionTrials =
        trialLeadsByClassDate.get(`${row.class.id}:${row.session.scheduledDate}`) ?? [];
      for (const t of sessionTrials) {
        expected.trial += 1;
        studentsToMark.push(t.id);
        if (t.attendanceSaved) savedCount += 1;
      }
    }

    const waivedCount = waiveOnSession.size;
    const attendanceMarked = isCancelled
      ? true
      : studentsToMark.length === 0
        ? waivedCount > 0
        : studentsToMark.every((id) => {
            if (trialLeadSavedById.has(id)) return trialLeadSavedById.get(id)!;
            return isSessionAttendanceSaved(sessionRecords.get(id));
          });

    return {
      ...row,
      expected,
      expectedLabel: formatSessionExpectedLabel(expected, waivedCount),
      waivedCount,
      /** Number of actively enrolled students on this date (before waive/hide filtering). */
      rosterSize: roster.length,
      studentsToMarkCount: studentsToMark.length,
      savedCount,
      attendanceMarked,
      attendanceMarkLabel: isCancelled
        ? "Cancelled"
        : formatAttendanceMarkLabel(
            attendanceMarked,
            studentsToMark.length,
            savedCount,
            waivedCount,
          ),
    };
  });
}
