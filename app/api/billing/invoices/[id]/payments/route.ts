import { assertCanUseBilling } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { recordPayment } from "@/lib/billing/invoice-db";
import { dbErrorMessage } from "@/lib/db/query-error";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await assertCanUseBilling();
    const { id } = await params;
    const body = (await request.json()) as {
      amount?: number;
      paymentDate?: string;
      notes?: string;
    };

    if (!body.amount || body.amount <= 0) return jsonError("amount must be positive.");
    if (!body.paymentDate) return jsonError("paymentDate is required.");

    const updated = await recordPayment(id, {
      amount: body.amount,
      paymentDate: body.paymentDate,
      notes: body.notes ?? "",
      recordedBy: user.email,
    });

    return jsonOk({ invoice: updated });
  } catch (err) {
    return jsonError(dbErrorMessage(err, "Failed to record payment"), 500);
  }
}
