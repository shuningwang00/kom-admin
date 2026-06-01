import {
  listNeedsMakeupScheduling,
  listReliefTutorNeededSessions,
} from "@/lib/attendance/makeup-hub";
import { listAllScheduledMakeupsEver } from "@/lib/attendance/makeup-booking";
import { assertCanAccessMakeupHub } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await assertCanAccessMakeupHub();
    const today = new Date().toISOString().slice(0, 10);
    const [needs, scheduled, reliefNeeded] = await Promise.all([
      listNeedsMakeupScheduling(),
      listAllScheduledMakeupsEver(),
      listReliefTutorNeededSessions(),
    ]);
    const upcomingCount = scheduled.filter((r) => r.makeupDate >= today).length;
    const needsCount = needs.length + upcomingCount + reliefNeeded.length;
    return jsonOk({ needsCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message.includes("Sign in") || message === "Unauthorized" ? 401 : 403;
    return jsonError(message, status);
  }
}
