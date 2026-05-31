import { listUnmarkedPastSessions } from "@/lib/attendance/list-sessions";
import { jsonError, jsonOk } from "@/lib/api/json";
import { requireEffectiveUser } from "@/lib/auth/access";
import { todayCalendarDate } from "@/lib/dates/calendar";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireEffectiveUser();
    const before =
      new URL(request.url).searchParams.get("before")?.trim() ??
      todayCalendarDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) {
      return jsonError("Query ?before=YYYY-MM-DD must be a valid date.");
    }

    const sessions = await listUnmarkedPastSessions(user, before);
    return jsonOk({ before, sessions, count: sessions.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}
