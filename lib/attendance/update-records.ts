import { syncMakeupCompleteOnSource } from "@/lib/attendance/makeup-booking";
import { isMakeupLessonSession } from "@/lib/attendance/makeup-session-rules";
import { isWalkInAttendance } from "@/lib/attendance/walk-in";
import {
  type AttendanceStatus,
  SESSION_MARKING_STATUSES,
} from "@/lib/attendance/status";
import { isSessionAttendanceSaved } from "@/lib/attendance/attendance-saved";
import { writeAuditLog } from "@/lib/attendance/audit";
import { consolidatedSessionIds } from "@/lib/attendance/session-slot-matching";
import { handleWaivedSession } from "@/lib/billing/invoice-db";
import type { SessionUser } from "@/lib/auth/config";
import { getDb } from "@/lib/db/index";
import { attendanceRecords, classSessions } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export async function updateAttendanceRecords(params: {
  actor: SessionUser;
  sessionId: string;
  updates: Array<{
    studentId: string;
    status: AttendanceStatus;
    makeupNote?: string;
  }>;
}) {
  const db = getDb();
  const allowed = SESSION_MARKING_STATUSES;
  const sessionIds = await consolidatedSessionIds(db, params.sessionId);

  for (const u of params.updates) {
    if (!allowed.includes(u.status)) {
      throw new Error(`Status "${u.status}" is not allowed for your role.`);
    }

    const matches = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          inArray(attendanceRecords.sessionId, sessionIds),
          eq(attendanceRecords.studentId, u.studentId),
        ),
      );

    const existing =
      matches.find((r) => isSessionAttendanceSaved(r)) ??
      matches.find((r) => r.sessionId === params.sessionId) ??
      matches[0];

    const targetSessionId = existing?.sessionId ?? params.sessionId;

    const before = existing
      ? { status: existing.status, makeupNote: existing.makeupNote }
      : null;

    const resolvedNote = u.makeupNote?.trim()
      ? u.makeupNote
      : isWalkInAttendance(existing?.makeupNote)
        ? ""
        : (existing?.makeupNote ?? "");

    if (existing) {
      await db
        .update(attendanceRecords)
        .set({
          status: u.status,
          makeupNote: resolvedNote,
          updatedBy: params.actor.email,
          updatedAt: new Date(),
        })
        .where(eq(attendanceRecords.id, existing.id));
    } else {
      await db.insert(attendanceRecords).values({
        sessionId: targetSessionId,
        studentId: u.studentId,
        status: u.status,
        makeupNote: u.makeupNote ?? "",
        updatedBy: params.actor.email,
      });
    }

    await writeAuditLog({
      actor: params.actor,
      action: "update_attendance",
      entityType: "attendance",
      entityId: `${targetSessionId}:${u.studentId}`,
      before: before ?? {},
      after: { status: u.status, makeupNote: u.makeupNote ?? "" },
    });

    if (u.status === "waive") {
      await handleWaivedSession(existing?.id, targetSessionId, u.studentId);
    }

    const noteForSync = resolvedNote.trim();
    if (u.status === "present" && noteForSync && /MU on/i.test(noteForSync)) {
      const [makeupSession] = await db
        .select({ scheduledDate: classSessions.scheduledDate })
        .from(classSessions)
        .where(eq(classSessions.id, params.sessionId))
        .limit(1);

      if (
        makeupSession &&
        isMakeupLessonSession(makeupSession.scheduledDate, noteForSync)
      ) {
        await syncMakeupCompleteOnSource({
          actor: params.actor,
          makeupSessionId: params.sessionId,
          studentId: u.studentId,
          makeupNote: noteForSync,
        });
      }
    }
  }
}
