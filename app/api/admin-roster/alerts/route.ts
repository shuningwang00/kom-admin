import { jsonError, jsonOk } from "@/lib/api/json";
import { isOwner, requireEffectiveUser } from "@/lib/auth/access";
import { suggestedAvailabilityMonth } from "@/lib/centre-hours";
import { getDb } from "@/lib/db/index";
import { computeRosterAlerts } from "@/lib/people/admin-roster";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireEffectiveUser();
    if (!isOwner(user)) return jsonError("Owner access required.", 403);

    const { searchParams } = new URL(request.url);
    const month =
      searchParams.get("month")?.trim() || suggestedAvailabilityMonth();

    const db = getDb();
    const result = await computeRosterAlerts(db, month);
    return jsonOk({
      month,
      ...result,
      totalCount: result.alerts.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, 403);
  }
}
