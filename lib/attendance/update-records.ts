import {
  ADMIN_ONLY_STATUSES,
  type AttendanceStatus,
  TUTOR_ALLOWED_STATUSES,
} from "@/lib/attendance/status";
import { writeAuditLog } from "@/lib/attendance/audit";
import type { SessionUser } from "@/lib/auth/config";
import { getDb } from "@/lib/db/index";
import { attendanceRecords } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

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
  const allowed =
    params.actor.role === "owner" || params.actor.role === "staff"
      ? [...TUTOR_ALLOWED_STATUSES, ...ADMIN_ONLY_STATUSES]
      : TUTOR_ALLOWED_STATUSES;

  for (const u of params.updates) {
    if (!allowed.includes(u.status)) {
      throw new Error(`Status "${u.status}" is not allowed for your role.`);
    }

    const [existing] = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.sessionId, params.sessionId),
          eq(attendanceRecords.studentId, u.studentId),
        ),
      )
      .limit(1);

    const before = existing
      ? { status: existing.status, makeupNote: existing.makeupNote }
      : null;

    if (existing) {
      await db
        .update(attendanceRecords)
        .set({
          status: u.status,
          makeupNote: u.makeupNote ?? existing.makeupNote,
          updatedBy: params.actor.email,
          updatedAt: new Date(),
        })
        .where(eq(attendanceRecords.id, existing.id));
    } else {
      await db.insert(attendanceRecords).values({
        sessionId: params.sessionId,
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
      entityId: `${params.sessionId}:${u.studentId}`,
      before: before ?? {},
      after: { status: u.status, makeupNote: u.makeupNote ?? "" },
    });
  }
}
