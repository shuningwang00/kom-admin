import { assertCanUseBilling } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { loadBillingGroupNameMap } from "@/lib/billing-groups/name-map";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await assertCanUseBilling();
    const { groups } = await loadBillingGroupNameMap();
    return jsonOk({ groups });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}
