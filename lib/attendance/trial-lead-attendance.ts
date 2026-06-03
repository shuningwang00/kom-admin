import { isSessionAttendanceSaved } from "@/lib/attendance/attendance-saved";
import { writeAuditLog } from "@/lib/attendance/audit";
import {
  resolveStoredMarkingStatus,
  SESSION_MARKING_STATUSES,
  type AttendanceStatus,
} from "@/lib/attendance/status";
import type { SessionUser } from "@/lib/auth/config";
import { sessionIsoDate } from "@/lib/dates/session-date";
import { getDb } from "@/lib/db/index";
import { classSessions, trialLeads } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export type SessionTrialLeadRow = {
  trialLeadId: string;
  name: string;
  status: AttendanceStatus;
  attendanceSaved: boolean;
  trialStatus: "active" | "converted" | "declined";
};

export async function listTrialLeadsForSession(
  classId: string,
  sessionDate: string,
): Promise<SessionTrialLeadRow[]> {
  const db = getDb();
  const date = sessionIsoDate(sessionDate);
  const rows = await db
    .select()
    .from(trialLeads)
    .where(
      and(
        eq(trialLeads.classId, classId),
        eq(trialLeads.trialDate, date),
      ),
    );

  return rows.map((trial) => {
    const status = resolveStoredMarkingStatus(trial.trialAttendanceStatus);
    return {
      trialLeadId: trial.id,
      name: trial.name,
      status,
      attendanceSaved: isSessionAttendanceSaved({
        status,
        updatedBy: trial.trialAttendanceUpdatedBy,
      }),
      trialStatus: trial.status,
    };
  });
}

export async function updateTrialLeadAttendance(params: {
  actor: SessionUser;
  sessionId: string;
  classId: string;
  sessionDate: string;
  updates: Array<{ trialLeadId: string; status: AttendanceStatus }>;
}) {
  const db = getDb();
  const date = sessionIsoDate(params.sessionDate);

  for (const u of params.updates) {
    if (!SESSION_MARKING_STATUSES.includes(u.status)) {
      throw new Error(`Status "${u.status}" is not allowed for a trial student.`);
    }

    const [trial] = await db
      .select()
      .from(trialLeads)
      .where(
        and(
          eq(trialLeads.id, u.trialLeadId),
          eq(trialLeads.status, "active"),
          eq(trialLeads.classId, params.classId),
          eq(trialLeads.trialDate, date),
        ),
      )
      .limit(1);

    if (!trial) {
      throw new Error("Trial student not found for this session.");
    }

    await db
      .update(trialLeads)
      .set({
        trialAttendanceStatus: u.status,
        trialAttendanceUpdatedBy: params.actor.email,
        updatedAt: new Date(),
      })
      .where(eq(trialLeads.id, trial.id));

    await writeAuditLog({
      actor: params.actor,
      action: "update_trial_attendance",
      entityType: "trial_lead",
      entityId: trial.id,
      after: { sessionId: params.sessionId, status: u.status },
    });
  }
}

/** After convert, copy trial lesson attendance onto the new student record. */
export async function copyTrialAttendanceToStudent(
  db: ReturnType<typeof getDb>,
  trial: {
    classId: string | null;
    trialDate: string | null;
    trialAttendanceStatus: AttendanceStatus | null;
    trialAttendanceUpdatedBy: string;
  },
  studentId: string,
) {
  if (!trial.classId || !trial.trialDate || !trial.trialAttendanceStatus) {
    return;
  }

  const { attendanceRecords } = await import("@/lib/db/schema");
  const [session] = await db
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.classId, trial.classId),
        eq(classSessions.scheduledDate, trial.trialDate),
      ),
    )
    .limit(1);

  if (!session) return;

  const updatedBy = trial.trialAttendanceUpdatedBy.trim() || "system";
  await db
    .insert(attendanceRecords)
    .values({
      sessionId: session.id,
      studentId,
      status: trial.trialAttendanceStatus,
      makeupNote: "",
      updatedBy,
    })
    .onConflictDoNothing();
}
