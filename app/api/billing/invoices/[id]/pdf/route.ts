import { assertCanUseBilling } from "@/lib/auth/access";
import { jsonError } from "@/lib/api/json";
import { getInvoice, updateInvoicePdf } from "@/lib/billing/invoice-db";
import { renderDbInvoicePdf } from "@/lib/pdf/render";
import { formatInvoiceDates } from "@/lib/pdf/format";
import { uploadInvoicePdfToDrive } from "@/lib/google/drive";
import { pdfNextResponse } from "@/lib/pdf/response";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanUseBilling();
    const { id } = await params;

    const invoice = await getInvoice(id);
    if (!invoice) return jsonError("Invoice not found.", 404);
    if (invoice.status === "void") return jsonError("Cannot generate PDF for a voided invoice.", 400);

    const { issuedAt, dueAt } = formatInvoiceDates(invoice.sentAt ?? new Date());

    // Group line items by student for per-student sections in the PDF
    const studentSections = invoice.studentEntries.map((se) => ({
      name: se.studentName,
      lineItems: invoice.lineItems.filter(
        (l) => l.studentId === se.studentId || (l.studentId === null && se === invoice.studentEntries[0]),
      ),
    }));

    const buffer = await renderDbInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      contactName: invoice.contactName,
      studentNames: invoice.studentNames,
      students: studentSections,
      subtotal: parseFloat(invoice.subtotal),
      discountAmount: parseFloat(invoice.discountAmount),
      balanceForward: parseFloat(invoice.balanceForward),
      creditApplied: parseFloat(invoice.creditApplied),
      totalDue: parseFloat(invoice.totalDue),
      issuedAt,
      dueAt,
      remarks: invoice.remarks || undefined,
    });

    const nameSlug = invoice.studentNames.join("-").replace(/\s+/g, "-");
    const fileName = `${invoice.invoiceNumber}-${nameSlug}.pdf`;
    const { fileId, fileName: savedName } = await uploadInvoicePdfToDrive(buffer, fileName, invoice.billingMonth);
    await updateInvoicePdf(id, { pdfFileId: fileId, pdfFileName: savedName });

    return pdfNextResponse(buffer, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate PDF";
    return jsonError(msg, 500);
  }
}
