import { jsonError, jsonOk } from "@/lib/api/json";
import { isOwner, requireEffectiveUser } from "@/lib/auth/access";
import { getPendingClaimsCount } from "@/lib/people/claims";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireEffectiveUser();
    if (!isOwner(user)) return jsonOk({ pendingCount: 0 });
    const pendingCount = await getPendingClaimsCount();
    return jsonOk({ pendingCount });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}
