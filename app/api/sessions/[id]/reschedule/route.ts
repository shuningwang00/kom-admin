import { writeAuditLog } from "@/lib/attendance/audit";
import { loadSessionDetail } from "@/lib/attendance/session-detail";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertSessionNotCancelled } from "@/lib/attendance/cancel-session";
import { assertCanMarkAttendance } from "@/lib/auth/access";
import { dbErrorMessage } from "@/lib/db/query-error";
import { getDb } from "@/lib/db/index";
import { classSessions } from "@/lib/db/schema";
import { assertRescheduleDateAvailable } from "@/lib/scheduling/reschedule-session";
import {
  isWithinCentreHours,
  normalizeTimeLabel,
  resolveRescheduleTimeLabel,
} from "@/lib/scheduling/time-slots";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const detail = await loadSessionDetail(id);
    if (!detail) return jsonError("Session not found.", 404);

    const user = await assertCanMarkAttendance(detail.class.tutor);
    assertSessionNotCancelled(detail.session.status);
    const body = (await request.json()) as {
      newDate?: string;
      timeLabel?: string;
      note?: string;
    };
    const newDate = body.newDate?.trim();
    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      return jsonError("newDate (YYYY-MM-DD) is required.");
    }

    const db = getDb();
    const originalDate = detail.session.scheduledDate;

    const rawTime = body.timeLabel?.trim() || detail.session.timeLabel;
    const timeLabel = resolveRescheduleTimeLabel(
      rawTime,
      detail.class.time,
    );
    if (!normalizeTimeLabel(timeLabel)) {
      return jsonError("Pick a valid time slot (1h 45min).");
    }
    if (!isWithinCentreHours(timeLabel)) {
      return jsonError("Time must be within centre hours (9am–8pm).");
    }

    if (newDate !== originalDate) {
      await assertRescheduleDateAvailable(db, detail.class.id, id, newDate, timeLabel);
    }

    const rescheduleNote = body.note?.trim() || "";

    const setOriginalDate =
      newDate !== originalDate && detail.session.originalDate == null
        ? originalDate
        : undefined;

    const [updated] = await db
      .update(classSessions)
      .set({
        scheduledDate: newDate,
        timeLabel,
        rescheduleNote,
        ...(setOriginalDate !== undefined ? { originalDate: setOriginalDate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(classSessions.id, id))
      .returning();

    if (!updated) return jsonError("Session not found.", 404);

    await writeAuditLog({
      actor: user,
      action: "reschedule_session",
      entityType: "class_session",
      entityId: id,
      before: { scheduledDate: originalDate, timeLabel: detail.session.timeLabel },
      after: { scheduledDate: newDate, timeLabel: updated.timeLabel, note: updated.rescheduleNote },
    });

    return jsonOk({ session: updated, newSessionId: null });
  } catch (err) {
    const message = dbErrorMessage(err, "Could not reschedule session.");
    const status = message.includes("access")
      ? 403
      : message.includes("already has a session") ||
          message.includes("Pick a valid") ||
          message.includes("centre hours") ||
          message.includes("newDate")
        ? 400
        : 500;
    return jsonError(message, status);
  }
}
