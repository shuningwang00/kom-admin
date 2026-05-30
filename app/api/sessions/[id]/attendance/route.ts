import type { AttendanceStatus } from "@/lib/attendance/status";
import { updateAttendanceRecords } from "@/lib/attendance/update-records";
import { loadSessionDetail } from "@/lib/attendance/session-detail";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanMarkAttendance } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const detail = await loadSessionDetail(id);
    if (!detail) return jsonError("Session not found.", 404);

    const user = await assertCanMarkAttendance(detail.class.tutor);
    const body = (await request.json()) as {
      updates?: Array<{
        studentId: string;
        status: AttendanceStatus;
        makeupNote?: string;
      }>;
    };

    if (!body.updates?.length) {
      return jsonError("updates array is required.");
    }

    await updateAttendanceRecords({
      actor: user,
      sessionId: id,
      updates: body.updates,
    });

    const refreshed = await loadSessionDetail(id);
    if (!refreshed) return jsonError("Session not found.", 404);
    return jsonOk(refreshed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("not allowed") || message.includes("access")
          ? 403
          : 500;
    return jsonError(message, status);
  }
}
