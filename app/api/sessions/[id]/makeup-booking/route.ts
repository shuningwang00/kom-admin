import {
  cancelScheduledMakeup,
  updateScheduledMakeup,
} from "@/lib/attendance/makeup-booking";
import { loadSessionDetail } from "@/lib/attendance/session-detail";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanScheduleMakeup } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const detail = await loadSessionDetail(id);
    if (!detail) return jsonError("Session not found.", 404);

    const actor = await assertCanScheduleMakeup(detail.class.tutor);
    const body = (await request.json()) as { studentId?: string };
    if (!body.studentId?.trim()) {
      return jsonError("studentId is required.");
    }

    await cancelScheduledMakeup({
      actor,
      sourceSessionId: id,
      studentId: body.studentId.trim(),
    });

    const refreshed = await loadSessionDetail(id);
    if (!refreshed) return jsonError("Session not found.", 404);
    return jsonOk(refreshed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.includes("Only admins") ? 403 : 500;
    return jsonError(message, status);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const detail = await loadSessionDetail(id);
    if (!detail) return jsonError("Session not found.", 404);

    const actor = await assertCanScheduleMakeup(detail.class.tutor);
    const body = (await request.json()) as {
      studentId?: string;
      makeupDate?: string;
      note?: string;
      makeupClassId?: string;
      timeLabel?: string;
      reliefTutor?: string;
    };
    if (!body.studentId?.trim() || !body.makeupDate?.trim()) {
      return jsonError("studentId and makeupDate are required.");
    }

    await updateScheduledMakeup({
      actor,
      sourceSessionId: id,
      sourceClassId: detail.class.id,
      studentId: body.studentId.trim(),
      makeupDate: body.makeupDate.trim(),
      note: body.note,
      makeupClassId: body.makeupClassId?.trim() || undefined,
      timeLabel: body.timeLabel?.trim() || undefined,
      reliefTutor: body.reliefTutor?.trim() || undefined,
    });

    const refreshed = await loadSessionDetail(id);
    if (!refreshed) return jsonError("Session not found.", 404);
    return jsonOk(refreshed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.includes("Only admins") ? 403 : 500;
    return jsonError(message, status);
  }
}
