import {
  cancelClassSession,
  restoreClassSession,
} from "@/lib/attendance/cancel-session";
import { loadSessionDetail, toSessionDetailResponse } from "@/lib/attendance/session-detail";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanMarkAttendance } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const detail = await loadSessionDetail(id);
    if (!detail) return jsonError("Session not found.", 404);

    const user = await assertCanMarkAttendance(detail.class.tutor);
    const body = (await request.json()) as { note?: string; restore?: boolean };

    if (body.restore) {
      await restoreClassSession({ actor: user, sessionId: id });
    } else {
      await cancelClassSession({
        actor: user,
        sessionId: id,
        note: body.note,
      });
    }

    const refreshed = await loadSessionDetail(id);
    if (!refreshed) return jsonError("Session not found.", 404);
    return jsonOk(toSessionDetailResponse(refreshed, user.role));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("access")
          ? 403
          : message.includes("already") || message.includes("not cancelled")
            ? 400
            : 500;
    return jsonError(message, status);
  }
}
