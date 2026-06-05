import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanMutateClasses } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { attendanceRecords, classes, classSessions, weekdayEnum } from "@/lib/db/schema";
import { and, eq, gt, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

const WEEKDAYS = weekdayEnum.enumValues;

const WEEKDAY_DOW: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6, other: -1,
};

function sgtToday(): string {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function cancelOldWeekdaySessions(
  db: ReturnType<typeof getDb>,
  classId: string,
  oldWeekday: string,
): Promise<number> {
  const targetDow = WEEKDAY_DOW[oldWeekday] ?? -1;
  if (targetDow === -1) return 0;

  const futureSessions = await db
    .select({ id: classSessions.id, scheduledDate: classSessions.scheduledDate })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.classId, classId),
        eq(classSessions.status, "scheduled"),
        gt(classSessions.scheduledDate, sgtToday()),
      ),
    );

  if (futureSessions.length === 0) return 0;

  const sessionIds = futureSessions.map((s) => s.id);

  const attendedRows = await db
    .select({ sessionId: attendanceRecords.sessionId })
    .from(attendanceRecords)
    .where(
      and(
        inArray(attendanceRecords.sessionId, sessionIds),
        inArray(attendanceRecords.status, ["present", "makeup_done"]),
      ),
    );

  const attendedSet = new Set(attendedRows.map((r) => r.sessionId));

  const toCancel = futureSessions.filter((s) => {
    if (attendedSet.has(s.id)) return false;
    return new Date(s.scheduledDate + "T00:00:00Z").getUTCDay() === targetDow;
  });

  for (const session of toCancel) {
    await db
      .update(classSessions)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(classSessions.id, session.id));
  }

  return toCancel.length;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanMutateClasses();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const db = getDb();

    const updates: Partial<typeof classes.$inferInsert> = {};
    if (typeof body.level === "string") updates.level = body.level.trim();
    if (typeof body.subject === "string") updates.subject = body.subject.trim();
    if (typeof body.time === "string") updates.time = body.time.trim();
    if (typeof body.tutor === "string") updates.tutor = body.tutor.trim();
    if (typeof body.description === "string") updates.description = body.description.trim();
    if (typeof body.feePerLesson === "string") updates.feePerLesson = body.feePerLesson.trim();
    if (typeof body.isFull === "boolean") updates.isFull = body.isFull;
    if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
    if (typeof body.weekday === "string" && WEEKDAYS.includes(body.weekday as typeof WEEKDAYS[number])) {
      updates.weekday = body.weekday as typeof WEEKDAYS[number];
    }
    if (typeof body.classroom === "string" && ["", "c1", "c2"].includes(body.classroom)) {
      updates.classroom = body.classroom;
    }

    // Recompute label when level or subject changes
    if (updates.level !== undefined || updates.subject !== undefined) {
      const [existing] = await db.select().from(classes).where(eq(classes.id, id));
      const level = updates.level ?? existing?.level ?? "";
      const subject = updates.subject ?? existing?.subject ?? "";
      updates.label = [level, subject].filter(Boolean).join(" ") || (existing?.label ?? "");
    }

    if (Object.keys(updates).length === 0) return jsonError("No fields to update.");

    // Auto-cancel future sessions on the old weekday when weekday changes
    let cancelledSessions = 0;
    if (updates.weekday !== undefined) {
      const [existing] = await db.select({ weekday: classes.weekday }).from(classes).where(eq(classes.id, id));
      if (existing && existing.weekday !== updates.weekday) {
        cancelledSessions = await cancelOldWeekdaySessions(db, id, existing.weekday);
      }
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(classes)
      .set(updates)
      .where(eq(classes.id, id))
      .returning();

    if (!updated) return jsonError("Class not found.", 404);
    return jsonOk({ class: updated, cancelledSessions });
  } catch (err) {
    console.error("[PATCH /api/classes/[id]]", err);
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message.includes("owner") || message.includes("admin") ? 403 : 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanMutateClasses();
    const { id } = await params;
    const db = getDb();
    const { searchParams } = new URL(request.url);

    if (searchParams.get("hard") === "1") {
      const [deleted] = await db.delete(classes).where(eq(classes.id, id)).returning();
      if (!deleted) return jsonError("Class not found.", 404);
      return jsonOk({ deleted: true });
    }

    // Default: deactivate only
    const [updated] = await db
      .update(classes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(classes.id, id))
      .returning();
    if (!updated) return jsonError("Class not found.", 404);
    return jsonOk({ class: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message.includes("owner") || message.includes("admin") ? 403 : 500);
  }
}
