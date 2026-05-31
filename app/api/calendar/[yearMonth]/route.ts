import { jsonError, jsonOk } from "@/lib/api/json";
import { requireEffectiveUser } from "@/lib/auth/access";
import { loadCalendarMonth } from "@/lib/calendar/month-data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ yearMonth: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireEffectiveUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { yearMonth } = await params;
    const data = await loadCalendarMonth(yearMonth);
    return jsonOk(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}
