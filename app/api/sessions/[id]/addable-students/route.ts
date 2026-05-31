import { listAddableStudentsForSession } from "@/lib/attendance/session-add-student";
import { loadSessionDetail } from "@/lib/attendance/session-detail";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanMarkAttendance } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const detail = await loadSessionDetail(id);
    if (!detail) return jsonError("Session not found.", 404);

    await assertCanMarkAttendance(detail.class.tutor);
    const result = await listAddableStudentsForSession(id);
    if (!result) return jsonError("Session not found.", 404);

    return jsonOk(result);
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
