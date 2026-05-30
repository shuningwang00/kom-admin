import { writeAuditLog } from "@/lib/attendance/audit";
import { formatMakeupNote } from "@/lib/attendance/status";
import type { SessionUser } from "@/lib/auth/config";
import { getDb } from "@/lib/db/index";
import {
  attendanceRecords,
  classSessions,
  classes,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function scheduleMakeup(params: {
  actor: SessionUser;
  classId: string;
  studentId: string;
  makeupDate: string;
  note?: string;
}) {
  const db = getDb();
  const [cls] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, params.classId))
    .limit(1);
  if (!cls) throw new Error("Class not found.");

  const note =
    params.note?.trim() ||
    formatMakeupNote(new Date(`${params.makeupDate}T12:00:00`));

  let [session] = await db
    .select()
    .from(classSessions)
    .where(
      and(
        eq(classSessions.classId, params.classId),
        eq(classSessions.scheduledDate, params.makeupDate),
      ),
    )
    .limit(1);

  if (!session) {
    [session] = await db
      .insert(classSessions)
      .values({
        classId: params.classId,
        scheduledDate: params.makeupDate,
        timeLabel: cls.time,
        rescheduleNote: "Makeup session",
      })
      .returning();
  }

  const [existing] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.sessionId, session.id),
        eq(attendanceRecords.studentId, params.studentId),
      ),
    )
    .limit(1);

  const before = existing
    ? { status: existing.status, makeupNote: existing.makeupNote }
    : {};

  if (existing) {
    await db
      .update(attendanceRecords)
      .set({
        status: "makeup_scheduled",
        makeupNote: note,
        updatedBy: params.actor.email,
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, existing.id));
  } else {
    await db.insert(attendanceRecords).values({
      sessionId: session.id,
      studentId: params.studentId,
      status: "makeup_scheduled",
      makeupNote: note,
      updatedBy: params.actor.email,
    });
  }

  await writeAuditLog({
    actor: params.actor,
    action: "schedule_makeup",
    entityType: "attendance",
    entityId: `${session.id}:${params.studentId}`,
    before,
    after: { status: "makeup_scheduled", makeupNote: note, makeupDate: params.makeupDate },
  });

  return { sessionId: session.id, makeupNote: note };
}
