import { requireOwner } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { siteAllowlist } from "@/lib/db/schema";
import {
  loadPermissions,
  savePermissions,
  type AppPermissions,
} from "@/lib/settings/permissions";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireOwner();
    const db = getDb();
    const perms = await loadPermissions(db);

    const rows = await db
      .select({
        id: siteAllowlist.id,
        email: siteAllowlist.email,
        fullName: siteAllowlist.fullName,
        displayName: siteAllowlist.displayName,
        tutorMatch: siteAllowlist.tutorMatch,
        role: siteAllowlist.role,
        permissionsJson: siteAllowlist.permissionsJson,
      })
      .from(siteAllowlist)
      .where(eq(siteAllowlist.isActive, true))
      .orderBy(asc(siteAllowlist.fullName));

    const members = rows.map((row) => {
      const effectiveRole =
        row.role === "staff" || row.role === "staff_tutor" ? "staff" : "tutor";
      let userOverride: Record<string, boolean> = {};
      if (row.permissionsJson) {
        try { userOverride = JSON.parse(row.permissionsJson) as Record<string, boolean>; } catch {}
      }
      const basePerms: Record<string, boolean> =
        effectiveRole === "tutor"
          ? { ...(perms.tutor as Record<string, boolean>) }
          : { ...(perms.staff as Record<string, boolean>) };
      const resolvedPerms = { ...basePerms, ...userOverride };

      return {
        id: row.id,
        email: row.email,
        name: row.tutorMatch || row.displayName || row.fullName || row.email,
        role: effectiveRole as "tutor" | "staff",
        tutorMatch: row.tutorMatch,
        resolvedPerms,
      };
    });

    return jsonOk({ permissions: perms, members });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message.includes("Owner") ? 403 : 401);
  }
}

export async function PATCH(request: Request) {
  try {
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
