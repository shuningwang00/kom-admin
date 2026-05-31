import {
  ensureAttendanceRows,
  loadSessionDetail,
  toSessionDetailResponse,
} from "@/lib/attendance/session-detail";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanMarkAttendance } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const detail = await loadSessionDetail(id);
    if (!detail) return jsonError("Session not found.", 404);

    const user = await assertCanMarkAttendance(detail.class.tutor);
    await ensureAttendanceRows(id, detail.class.id);
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
          : 500;
    return jsonError(message, status);
  }
}
