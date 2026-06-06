import { assertCanUseBilling } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { updatePayment, deletePayment } from "@/lib/billing/invoice-db";
import { dbErrorMessage } from "@/lib/db/query-error";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    await assertCanUseBilling();
    const { id, paymentId } = await params;
    const body = (await request.json()) as { amount?: number; paymentDate?: string; notes?: string };

    if (!body.amount || body.amount <= 0) return jsonError("amount must be positive.");
    if (!body.paymentDate) return jsonError("paymentDate is required.");

    const invoice = await updatePayment(id, paymentId, {
      amount: body.amount,
      paymentDate: body.paymentDate,
      notes: body.notes ?? "",
    });

    return jsonOk({ invoice });
  } catch (err) {
    return jsonError(dbErrorMessage(err, "Failed to update payment"), 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    await assertCanUseBilling();
    const { id, paymentId } = await params;
    const invoice = await deletePayment(id, paymentId);
    return jsonOk({ invoice });
  } catch (err) {
    return jsonError(dbErrorMessage(err, "Failed to delete payment"), 500);
  }
}
