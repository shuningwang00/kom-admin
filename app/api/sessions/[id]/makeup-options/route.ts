import { listMakeupPeerClasses } from "@/lib/attendance/makeup-options";
import { loadSessionDetail } from "@/lib/attendance/session-detail";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanScheduleMakeup } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const detail = await loadSessionDetail(id);
    if (!detail) return jsonError("Session not found.", 404);

    await assertCanScheduleMakeup(detail.class.tutor);
    const result = await listMakeupPeerClasses(
      detail.class.id,
      detail.session.scheduledDate,
    );
    return jsonOk(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.includes("Only admins") ? 403 : 500;
    return jsonError(message, status);
  }
}
