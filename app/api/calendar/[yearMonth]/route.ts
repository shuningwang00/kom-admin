import { jsonError, jsonOk } from "@/lib/api/json";
import { isOwner, isReliefTutor, requireEffectiveUser } from "@/lib/auth/access";
import { getTutorMatch } from "@/lib/auth/user";
import { loadCalendarMonth } from "@/lib/calendar/month-data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ yearMonth: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireEffectiveUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { yearMonth } = await params;
    const owner = isOwner(user);
    const reliefOnly = isReliefTutor(user);
    const tutorMatch = reliefOnly ? await getTutorMatch(user) : "";
    const data = await loadCalendarMonth(yearMonth, {
      includeDraftShifts: owner,
      tutorMatch: tutorMatch || undefined,
    });
    return jsonOk({
      ...data,
      canManageRoster: owner,
      scopedToOwnClasses: reliefOnly,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}
