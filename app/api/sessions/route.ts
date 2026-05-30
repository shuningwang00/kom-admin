import { listSessionsForDate } from "@/lib/attendance/list-sessions";
import { jsonError, jsonOk } from "@/lib/api/json";
import { requireEffectiveUser } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireEffectiveUser();
    const date = new URL(request.url).searchParams.get("date")?.trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonError("Query ?date=YYYY-MM-DD is required.");
    }
    const sessions = await listSessionsForDate(date, user);
    return jsonOk({ date, sessions, role: user.role });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}
