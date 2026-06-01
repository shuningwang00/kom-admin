import { listSessionsForDate } from "@/lib/attendance/list-sessions";
import { jsonError, jsonOk } from "@/lib/api/json";
import { requireEffectiveUser } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { loadPermissions } from "@/lib/settings/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireEffectiveUser();
    const date = new URL(request.url).searchParams.get("date")?.trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonError("Query ?date=YYYY-MM-DD is required.");
    }

    // Compute canGenerateSessions here so attendance-daily doesn't need a second /api/auth/me call.
    let canGenerateSessions = user.role === "owner";
    if (user.role === "staff") {
      const db = getDb();
      const globalPerms = await loadPermissions(db);
      let userOverride: Record<string, boolean> = {};
      if (user.permissionsJson) {
        try { userOverride = JSON.parse(user.permissionsJson) as Record<string, boolean>; } catch {}
      }
      canGenerateSessions = userOverride.generateSessions ?? globalPerms.staff.generateSessions;
    }

    const sessions = await listSessionsForDate(date, user);
    return jsonOk({ date, sessions, role: user.role, canGenerateSessions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}
