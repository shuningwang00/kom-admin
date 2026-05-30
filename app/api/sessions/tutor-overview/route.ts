import { listTutorSessionsOverview } from "@/lib/attendance/list-sessions";
import { jsonError, jsonOk } from "@/lib/api/json";
import { requireEffectiveUser } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireEffectiveUser();
    const groups = await listTutorSessionsOverview(user);
    return jsonOk({ groups, role: user.role });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}
