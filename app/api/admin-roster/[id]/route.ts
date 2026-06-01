import { jsonError, jsonOk } from "@/lib/api/json";
import { isOwner, requireEffectiveUser } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { deleteRosterShift } from "@/lib/people/admin-roster";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireEffectiveUser();
    if (!isOwner(user)) return jsonError("Owner access required.", 403);
    const { id } = await params;
    const db = getDb();
    await deleteRosterShift(db, id);
    return jsonOk({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, 403);
  }
}
