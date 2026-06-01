import { requireOwner } from "@/lib/auth/access";
import { hasSitePasswordAuth } from "@/lib/auth/password";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import {
  loadPermissions,
  savePermissions,
  type AppPermissions,
} from "@/lib/settings/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await hasSitePasswordAuth())) return jsonError("Unauthorized", 401);
    await requireOwner();
    const db = getDb();
    const perms = await loadPermissions(db);
    return jsonOk({ permissions: perms });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message.includes("Owner") ? 403 : 401);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await hasSitePasswordAuth())) return jsonError("Unauthorized", 401);
    await requireOwner();
    const body = (await request.json()) as Partial<AppPermissions>;
    const db = getDb();
    const current = await loadPermissions(db);
    const updated: AppPermissions = {
      tutor: { ...current.tutor, ...body.tutor },
      staff: { ...current.staff, ...body.staff },
    };
    await savePermissions(db, updated);
    return jsonOk({ permissions: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message.includes("Owner") ? 403 : 401);
  }
}
