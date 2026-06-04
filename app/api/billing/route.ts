import { assertCanUseBilling } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { listBillingDashboard } from "@/lib/billing/invoice-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await assertCanUseBilling();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month")?.trim() ?? "";
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return jsonError("month must be YYYY-MM");
    }
    const rows = await listBillingDashboard(month);
    return jsonOk({ rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return jsonError(msg, msg.includes("Billing") || msg.includes("Unauthorized") ? 401 : 500);
  }
}
