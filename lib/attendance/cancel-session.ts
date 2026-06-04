import { writeAuditLog } from "@/lib/attendance/audit";
import { formatShortDate } from "@/lib/attendance/makeup-display";
import type { SessionHeadcountResult } from "@/lib/attendance/session-headcount";
import type { SessionExpectedCounts } from "@/lib/attendance/session-expected-labels";
import type { AttendanceStatus } from "@/lib/attendance/status";
import type { SessionUser } from "@/lib/auth/config";
import { handleCancelledSessionBilling, reverseSessionCredits } from "@/lib/billing/invoice-db";
import { getDb } from "@/lib/db/index";
import {
  attendanceRecords,
  classSessions,
  classes,
} from "@/lib/db/schema";
import { rosterForClassOnDate, loadClassRosterRows } from "@/lib/enrollments/roster-query";
import { eq } from "drizzle-orm";

/** Prefix stored on attendance.makeup_note when class was cancelled. */
export const CANCELLED_SESSION_MAKEUP_NOTE_PREFIX = "M/U · cancelled session";

export function formatCancelledSessionMakeupNote(scheduledDate: string): string {
  return `${CANCELLED_SESSION_MAKEUP_NOTE_PREFIX} ${formatShortDate(scheduledDate)}`;
}

export function isCancelledSessionMakeupNote(note: string | null | undefined): boolean {
  return (note ?? "").trim().startsWith(CANCELLED_SESSION_MAKEUP_NOTE_PREFIX);
}

/** Headcount for a cancelled session: no lesson expected; track Needs M/U count. */
export function computeCancelledSessionHeadcount(
  roster: Array<{ studentId: string }>,
  sessionRecords: Map<
    string,
    { status: AttendanceStatus; makeupNote: string }
  >,
): SessionHeadcountResult {
  let notified = 0;
  let savedCount = 0;
  for (const { studentId } of roster) {
    const record = sessionRecords.get(studentId);
    const status = record?.status ?? "absent_pending";
    if (status === "waive") continue;
    if (status === "absent_notified") {
      notified += 1;
      savedCount += 1;
    }
  }
  const expected: SessionExpectedCounts = {
    regular: 0,
    trial: 0,
    makeup: 0,
    notified,
  };
  return { expected, studentsToMark: [], savedCount };
}

async function loadSessionContext(sessionId: string) {
  const db = getDb();
  const [row] = await db
    .select({ session: classSessions, class: classes })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(eq(classSessions.id, sessionId))
    .limit(1);
  return row ? { db, ...row } : null;
}

export async function cancelClassSession(params: {
  actor: SessionUser;
  sessionId: string;
  note?: string;
}) {
  const ctx = await loadSessionContext(params.sessionId);
  if (!ctx) throw new Error("Session not found.");
  if (ctx.session.status === "cancelled") {
    throw new Error("This session is already cancelled.");
  }

  const { db, session, class: cls } = ctx;
  const rosterRows = await loadClassRosterRows([cls.id]);
  const roster = rosterForClassOnDate(rosterRows, cls.id, session.scheduledDate);
  const makeupNote = formatCancelledSessionMakeupNote(session.scheduledDate);

  const existingRecords = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.sessionId, params.sessionId));

  const byStudent = new Map(
    existingRecords.map((r) => [r.studentId, r]),
  );

  const cancelNote = params.note?.trim();
  const rescheduleNote = cancelNote
    ? session.rescheduleNote.trim()
      ? `${session.rescheduleNote.trim()} · Cancelled: ${cancelNote}`
      : `Cancelled: ${cancelNote}`
    : session.rescheduleNote.trim()
      ? `${session.rescheduleNote.trim()} · Class cancelled`
      : "Class cancelled";

  await db
    .update(classSessions)
    .set({
      status: "cancelled",
      rescheduleNote,
      updatedAt: new Date(),
    })
    .where(eq(classSessions.id, params.sessionId));

  for (const { studentId } of roster) {
    const existing = byStudent.get(studentId);
    if (existing?.status === "waive") continue;

    if (existing) {
      await db
        .update(attendanceRecords)
        .set({
          status: "absent_notified",
          makeupNote,
          updatedBy: params.actor.email,
          updatedAt: new Date(),
        })
        .where(eq(attendanceRecords.id, existing.id));
    } else {
      await db.insert(attendanceRecords).values({
        sessionId: params.sessionId,
        studentId,
        status: "absent_notified",
        makeupNote,
        updatedBy: params.actor.email,
      });
    }

    await writeAuditLog({
      actor: params.actor,
      action: "cancel_session_mark_mu",
      entityType: "attendance",
      entityId: `${params.sessionId}:${studentId}`,
      before: existing
        ? { status: existing.status, makeupNote: existing.makeupNote }
        : {},
      after: { status: "absent_notified", makeupNote },
    });
  }

  await writeAuditLog({
    actor: params.actor,
    action: "cancel_session",
    entityType: "class_session",
    entityId: params.sessionId,
    before: {
      status: session.status,
      rescheduleNote: session.rescheduleNote,
    },
    after: { status: "cancelled", rescheduleNote, rosterCount: roster.length },
  });

  await handleCancelledSessionBilling(
    params.sessionId,
    roster.map((r) => r.studentId),
  );

  return { rosterCount: roster.length, makeupNote };
}

function stripCancelSuffix(note: string): string {
  if (note === "Class cancelled") return "";
  if (note.endsWith(" · Class cancelled")) return note.slice(0, -" · Class cancelled".length);
  if (note.startsWith("Cancelled: ")) return "";
  const idx = note.lastIndexOf(" · Cancelled: ");
  if (idx !== -1) return note.slice(0, idx);
  return note;
}

export async function restoreClassSession(params: {
  actor: SessionUser;
  sessionId: string;
}) {
  const ctx = await loadSessionContext(params.sessionId);
  if (!ctx) throw new Error("Session not found.");
  if (ctx.session.status !== "cancelled") {
    throw new Error("This session is not cancelled.");
  }

  const { db, session, class: cls } = ctx;
  const records = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.sessionId, params.sessionId));

  const restoredNote = stripCancelSuffix(session.rescheduleNote ?? "");

  await db
    .update(classSessions)
    .set({
      status: "scheduled",
      rescheduleNote: restoredNote,
      updatedAt: new Date(),
    })
    .where(eq(classSessions.id, params.sessionId));

  for (const record of records) {
    if (!isCancelledSessionMakeupNote(record.makeupNote)) continue;
    if (record.status !== "absent_notified") continue;

    await db
      .update(attendanceRecords)
      .set({
        status: "absent_pending",
        makeupNote: "",
        updatedBy: params.actor.email,
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, record.id));

    await writeAuditLog({
      actor: params.actor,
      action: "restore_session_clear_mu",
      entityType: "attendance",
      entityId: `${params.sessionId}:${record.studentId}`,
      before: { status: record.status, makeupNote: record.makeupNote },
      after: { status: "absent_pending", makeupNote: "" },
    });
  }

  await writeAuditLog({
    actor: params.actor,
    action: "restore_session",
    entityType: "class_session",
    entityId: params.sessionId,
    before: { status: "cancelled" },
    after: { status: "scheduled" },
  });

  await reverseSessionCredits(params.sessionId);
}

export function assertSessionNotCancelled(status: string): void {
  if (status === "cancelled") {
    throw new Error(
      "This class session was cancelled. Restore it before marking attendance or rescheduling.",
    );
  }
}
