import { assertCanUseBilling } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getInvoice, markInvoiceSent, voidInvoice } from "@/lib/billing/invoice-db";
import { getDb } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanUseBilling();
    const { id } = await params;
    const invoice = await getInvoice(id);
    if (!invoice) return jsonError("Invoice not found.", 404);
    return jsonOk({ invoice });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return jsonError(msg, 500);
  }
}

/** Update remarks or void. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await assertCanUseBilling();
    const { id } = await params;
    const body = (await request.json()) as { remarks?: string; void?: boolean; markSent?: boolean };

    if (body.void) {
      await voidInvoice(id, user.email);
      return jsonOk({ voided: true });
    }

    if (body.markSent) {
      await markInvoiceSent(id);
      return jsonOk({ sent: true });
    }

    if (body.remarks !== undefined) {
      const db = getDb();
      const [updated] = await db
        .update(invoices)
        .set({ remarks: body.remarks, updatedAt: new Date() })
        .where(eq(invoices.id, id))
        .returning();
      return jsonOk({ invoice: updated });
    }

    return jsonError("No update specified.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return jsonError(msg, 500);
  }
}
