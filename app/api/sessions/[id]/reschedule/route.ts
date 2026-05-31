import { writeAuditLog } from "@/lib/attendance/audit";
import { loadSessionDetail } from "@/lib/attendance/session-detail";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanMarkAttendance } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { classSessions } from "@/lib/db/schema";
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
    const before = {
      scheduledDate: detail.session.scheduledDate,
      timeLabel: detail.session.timeLabel,
    };

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

    const [updated] = await db
      .update(classSessions)
      .set({
        scheduledDate: newDate,
        timeLabel,
        rescheduleNote: body.note?.trim() || detail.session.rescheduleNote,
        updatedAt: new Date(),
      })
      .where(eq(classSessions.id, id))
      .returning();

    await writeAuditLog({
      actor: user,
      action: "reschedule_session",
      entityType: "class_session",
      entityId: id,
      before,
      after: {
        scheduledDate: updated.scheduledDate,
        timeLabel: updated.timeLabel,
        note: updated.rescheduleNote,
      },
    });

    return jsonOk({ session: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message.includes("access") ? 403 : 500);
  }
}
