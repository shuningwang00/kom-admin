import { assertCanUseBilling } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { computeInvoicePreview } from "@/lib/billing/compute-invoice";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await assertCanUseBilling();
    const { searchParams } = new URL(request.url);
    const studentIdsParam = searchParams.get("studentIds")?.trim() ?? searchParams.get("studentId")?.trim() ?? "";
    const month = searchParams.get("month")?.trim() ?? "";
    if (!studentIdsParam || !/^\d{4}-\d{2}$/.test(month)) {
      return jsonError("studentIds and month (YYYY-MM) are required.");
    }
    const studentIds = studentIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const preview = await computeInvoicePreview(studentIds, month);
    return jsonOk({ preview });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to compute preview";
    return jsonError(msg, 500);
  }
}
