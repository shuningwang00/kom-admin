import { listSessionsForDate, listSessionsForMonth } from "@/lib/attendance/list-sessions";
import { jsonError, jsonOk } from "@/lib/api/json";
import { requireEffectiveUser } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { loadPermissions } from "@/lib/settings/permissions";
import { listHolSessionsForDate } from "@/lib/programmes/list";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireEffectiveUser();
    const params = new URL(request.url).searchParams;
    const date = params.get("date")?.trim();
    const month = params.get("month")?.trim();

    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return jsonError("Query ?month=YYYY-MM is required.");
      }
      const sessions = await listSessionsForMonth(month, user);
      return jsonOk({ month, sessions, role: user.role });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonError("Query ?date=YYYY-MM-DD or ?month=YYYY-MM is required.");
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

    const [sessions, holSessions] = await Promise.all([
      listSessionsForDate(date, user),
      listHolSessionsForDate(date),
    ]);
    return jsonOk({ date, sessions, holSessions, role: user.role, canGenerateSessions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}
