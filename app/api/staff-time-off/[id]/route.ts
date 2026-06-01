import { jsonError, jsonOk } from "@/lib/api/json";
import { hasStaffPrivileges, isOwner, requireEffectiveUser } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { dbErrorMessage } from "@/lib/db/query-error";
import { deleteStaffTimeOff } from "@/lib/people/staff-time-off";
import { eq } from "drizzle-orm";
import { staffTimeOff } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireEffectiveUser();
    const { id } = await params;
    const db = getDb();

    const [row] = await db
      .select()
      .from(staffTimeOff)
      .where(eq(staffTimeOff.id, id))
      .limit(1);

    if (!row) return jsonError("Not found.", 404);

    if (!isOwner(user)) {
      if (!hasStaffPrivileges(user)) {
        return jsonError("Forbidden", 403);
      }
      if (row.staffEmail !== user.email.trim().toLowerCase()) {
        return jsonError("You can only remove your own time off.", 403);
      }
    }

    await deleteStaffTimeOff(db, id);
    return jsonOk({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const status = /required|sign in|forbidden|only remove/i.test(msg) ? 403 : 500;
    return jsonError(dbErrorMessage(err), status);
  }
}
