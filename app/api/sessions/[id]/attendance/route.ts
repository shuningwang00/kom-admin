import type { AttendanceStatus } from "@/lib/attendance/status";
import { updateAttendanceRecords } from "@/lib/attendance/update-records";
import {
  loadSessionDetail,
  toSessionDetailResponse,
} from "@/lib/attendance/session-detail";
import { updateTrialLeadAttendance } from "@/lib/attendance/trial-lead-attendance";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertSessionNotCancelled } from "@/lib/attendance/cancel-session";
import { assertCanMarkAttendance } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const detail = await loadSessionDetail(id);
    if (!detail) return jsonError("Session not found.", 404);

    const user = await assertCanMarkAttendance(detail.class.tutor);
    assertSessionNotCancelled(detail.session.status);
    const body = (await request.json()) as {
      updates?: Array<{
        studentId: string;
        status: AttendanceStatus;
        makeupNote?: string;
      }>;
      trialUpdates?: Array<{
        trialLeadId: string;
        status: AttendanceStatus;
      }>;
    };

    if (!body.updates?.length && !body.trialUpdates?.length) {
      return jsonError("updates or trialUpdates is required.");
    }

    if (body.updates?.length) {
      await updateAttendanceRecords({
        actor: user,
        sessionId: id,
        updates: body.updates,
      });
    }

    if (body.trialUpdates?.length) {
      await updateTrialLeadAttendance({
        actor: user,
        sessionId: id,
        classId: detail.class.id,
        sessionDate: detail.session.scheduledDate,
        updates: body.trialUpdates,
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
        : message.includes("not allowed") || message.includes("access")
          ? 403
          : 500;
    return jsonError(message, status);
  }
}
