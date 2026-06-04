import {
  ensureAttendanceRows,
  loadSessionDetail,
  toSessionDetailResponse,
} from "@/lib/attendance/session-detail";
import { writeAuditLog } from "@/lib/attendance/audit";
import { isSystemAttendanceActor } from "@/lib/attendance/status";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanMarkAttendance, assertCanScheduleMakeup } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { attendanceRecords, classSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const detail = await loadSessionDetail(id);
    if (!detail) return jsonError("Session not found.", 404);

    const user = await assertCanMarkAttendance(detail.class.tutor, detail.session.reliefTutor);
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

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const detail = await loadSessionDetail(id);
    if (!detail) return jsonError("Session not found.", 404);

    const user = await assertCanScheduleMakeup(detail.class.tutor);

    const db = getDb();
    const records = await db
      .select({ updatedBy: attendanceRecords.updatedBy })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.sessionId, id));

    const humanRecords = records.filter((r) => !isSystemAttendanceActor(r.updatedBy));
    if (humanRecords.length > 0) {
      return jsonError(
        "Session has saved attendance records. Clear them first or cancel instead.",
        400,
      );
    }

    await db.delete(classSessions).where(eq(classSessions.id, id));

    await writeAuditLog({
      actor: user,
      action: "delete_session",
      entityType: "class_session",
      entityId: id,
      before: {
        scheduledDate: detail.session.scheduledDate,
        classId: detail.class.id,
        classLabel: detail.class.label,
      },
      after: {},
    });

    return jsonOk({ ok: true });
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
