import { assertCanUseBilling } from "@/lib/auth/access";
import { jsonError } from "@/lib/api/json";
import { buildInvoiceNumber, invoiceIndexForRow } from "@/lib/invoice-number";
import { formatInvoiceDates } from "@/lib/pdf/format";
import { computeInvoiceTotals } from "@/lib/pdf/invoice-totals";
import { renderInvoicePdf, renderReceiptPdf } from "@/lib/pdf/render";
import { pdfNextResponse } from "@/lib/pdf/response";
import type { BillingPreview, StudentBillingRow } from "@/lib/types";
import { NextResponse } from "next/server";

type PdfRequestBody = {
  type: "invoice" | "receipt";
  preview: BillingPreview;
  row: StudentBillingRow;
  invoiceNumber?: string;
  receiptNumber?: string;
};

export async function POST(request: Request) {
  try {
    await assertCanUseBilling();
    const body = (await request.json()) as PdfRequestBody;
    const { type, preview, row } = body;

    if (!preview || !row) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const index = invoiceIndexForRow(preview.rows, row.id);
    const invoiceNumber =
      body.invoiceNumber ??
      buildInvoiceNumber(preview.yearMonth, index);
    const { issuedAt, dueAt } = formatInvoiceDates(new Date());

    if (type === "receipt") {
      const receiptNumber =
        body.receiptNumber?.trim() || row.receiptNo || invoiceNumber;
      const buffer = await renderReceiptPdf({
        receiptNumber,
        invoiceNumber,
        studentName: row.studentName,
        level: row.level,
        dayLabel: row.day,
        sessions: row.sessions,
        sessionCount: row.sessionCount,
        ratePerSession: row.ratePerSession,
        registrationFee: row.registrationFee,
        amount: row.computedAmount,
        paidAt: issuedAt,
      });
      const filename = `Receipt-${receiptNumber}-${row.studentName.replace(/\s+/g, "-")}.pdf`;
      return pdfNextResponse(buffer, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      });
    }

    const totals = computeInvoiceTotals(row, preview.rows);

    const buffer = await renderInvoicePdf({
      invoiceNumber,
      studentName: row.studentName,
      level: row.level,
      dayLabel: row.day,
      sessions: row.sessions,
      sessionCount: row.sessionCount,
      ratePerSession: row.ratePerSession,
      registrationFee: row.registrationFee,
      amount: totals.total,
      subtotal: totals.discount > 0 ? totals.subtotal : undefined,
      discount: totals.discount > 0 ? totals.discount : undefined,
      issuedAt,
      dueAt,
    });

    const filename = `Invoice-${invoiceNumber}-${row.studentName.replace(/\s+/g, "-")}.pdf`;
    return pdfNextResponse(buffer, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
  } catch (err) {
    console.error("pdf error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
