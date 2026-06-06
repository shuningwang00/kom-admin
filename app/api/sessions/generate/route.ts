import { generateSessionsForMonth } from "@/lib/scheduling/generate-sessions";
import { jsonError, jsonOk } from "@/lib/api/json";
import { requireEffectiveUser, hasStaffPrivileges } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { loadPermissions } from "@/lib/settings/permissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireEffectiveUser();
    if (user.role !== "owner") {
      if (!hasStaffPrivileges(user)) return jsonError("Forbidden", 403);
      const db = getDb();
      const perms = await loadPermissions(db);
      if (!perms.staff.generateSessions) return jsonError("Forbidden", 403);
    }
    const body = (await request.json().catch(() => ({}))) as {
      yearMonth?: string;
      classId?: string;
    };
    const yearMonth =
      body.yearMonth?.trim() || new Date().toISOString().slice(0, 7);
    const classId = body.classId?.trim() || undefined;
    const result = await generateSessionsForMonth(yearMonth, classId);
    return jsonOk({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message.includes("Admin") ? 403 : 500;
    return jsonError(message, status);
  }
}
