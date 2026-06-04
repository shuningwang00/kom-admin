import { assertCanUseBilling, requireEffectiveUser } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { computeInvoicePreview } from "@/lib/billing/compute-invoice";
import { createInvoice } from "@/lib/billing/invoice-db";
import { getDb } from "@/lib/db";
import { invoiceStudents, invoices, students } from "@/lib/db/schema";
import { desc, eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await assertCanUseBilling();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const db = getDb();

    const invRows = await db
      .select()
      .from(invoices)
      .orderBy(desc(invoices.billingMonth), desc(invoices.createdAt));

    const filtered = status ? invRows.filter((r) => r.status === status) : invRows;
    if (filtered.length === 0) return jsonOk({ invoices: [] });

    const invoiceIds = filtered.map((r) => r.id);
    const junctionRows = await db
      .select({ invoiceId: invoiceStudents.invoiceId, studentId: invoiceStudents.studentId })
      .from(invoiceStudents)
      .where(inArray(invoiceStudents.invoiceId, invoiceIds));

    const studentIds = [...new Set(junctionRows.map((r) => r.studentId))];
    const studentRows = studentIds.length > 0
      ? await db.select({ id: students.id, name: students.name }).from(students).where(inArray(students.id, studentIds))
      : [];
    const studentNameById = new Map(studentRows.map((s) => [s.id, s.name]));

    const studentsByInvoice = new Map<string, string[]>();
    for (const j of junctionRows) {
      if (!studentsByInvoice.has(j.invoiceId)) studentsByInvoice.set(j.invoiceId, []);
      studentsByInvoice.get(j.invoiceId)!.push(studentNameById.get(j.studentId) ?? "");
    }

    const result = filtered.map((inv) => ({
      ...inv,
      studentNames: (studentsByInvoice.get(inv.id) ?? []).sort(),
    }));

    return jsonOk({ invoices: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return jsonError(msg, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await assertCanUseBilling();
    const body = (await request.json()) as {
      studentIds?: string[];
      studentId?: string;
      billingMonth?: string;
      discountAmount?: number;
      remarks?: string;
    };

    const { billingMonth, discountAmount, remarks } = body;
    // Accept both new studentIds[] and legacy single studentId
    const studentIds = body.studentIds ?? (body.studentId ? [body.studentId] : []);

    if (studentIds.length === 0 || !billingMonth || !/^\d{4}-\d{2}$/.test(billingMonth)) {
      return jsonError("studentIds and billingMonth (YYYY-MM) are required.");
    }

    const preview = await computeInvoicePreview(studentIds, billingMonth);

    if (preview.existingInvoiceId) {
      return jsonError("Invoice already exists for this student and month.", 409);
    }

    if (preview.lineItems.filter((l) => l.type === "tuition" || l.type === "registration_fee").length === 0) {
      return jsonError("No billable sessions found for this student in the selected month.");
    }

    const invoice = await createInvoice(preview, {
      discountAmount: discountAmount ?? 0,
      remarks: remarks ?? "",
      createdBy: user.email,
    });

    return jsonOk({ invoice, preview });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create invoice";
    return jsonError(msg, msg.includes("Unauthorized") ? 401 : 500);
  }
}
