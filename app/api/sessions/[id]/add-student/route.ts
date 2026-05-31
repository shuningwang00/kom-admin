import { addWalkInStudentToSession } from "@/lib/attendance/session-add-student";
import {
  loadSessionDetail,
  toSessionDetailResponse,
} from "@/lib/attendance/session-detail";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanMarkAttendance } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const detail = await loadSessionDetail(id);
    if (!detail) return jsonError("Session not found.", 404);

    const actor = await assertCanMarkAttendance(detail.class.tutor);
    const body = (await request.json()) as { studentId?: string };
    if (!body.studentId?.trim()) {
      return jsonError("studentId is required.");
    }

    await addWalkInStudentToSession({
      actor,
      sessionId: id,
      studentId: body.studentId.trim(),
    });

    const refreshed = await loadSessionDetail(id);
    if (!refreshed) return jsonError("Session not found.", 404);
    return jsonOk(toSessionDetailResponse(refreshed, actor.role));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("access")
          ? 403
          : 500;
    return jsonError(message, status);
  }
}
