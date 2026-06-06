import { assertCanUseBilling } from "@/lib/auth/access";
import { jsonError } from "@/lib/api/json";
import { getInvoice, updateInvoiceReceipt } from "@/lib/billing/invoice-db";
import { renderDbReceiptPdf } from "@/lib/pdf/render";
import { deleteFileFromDrive, uploadBillingReceiptToDrive } from "@/lib/google/drive";
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
    if (invoice.status !== "paid" && invoice.status !== "partial") {
      return jsonError("Receipt can only be generated after payment is recorded.", 400);
    }

    const paidAt = invoice.paidAt
      ? invoice.paidAt.toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" });

    // Group line items by student for per-student sections
    const studentSections = invoice.studentEntries.map((se) => ({
      name: se.studentName,
      lineItems: invoice.lineItems.filter(
        (l) => l.studentId === se.studentId || (l.studentId === null && se === invoice.studentEntries[0]),
      ),
    }));

    const buffer = await renderDbReceiptPdf({
      receiptNumber: invoice.invoiceNumber.replace(/^INV/, "RCP"),
      invoiceNumber: invoice.invoiceNumber,
      contactName: invoice.contactName,
      studentNames: invoice.studentNames,
      students: studentSections,
      totalPaid: parseFloat(invoice.totalPaid),
      paidAt,
    });

    const nameSlug = invoice.studentNames.join("-").replace(/\s+/g, "-");
    const fileName = `${invoice.invoiceNumber}-${nameSlug}.pdf`;
    if (invoice.receiptFileId) {
      await deleteFileFromDrive(invoice.receiptFileId).catch(() => null);
    }

    const { fileId, fileName: savedName } = await uploadBillingReceiptToDrive(buffer, fileName, invoice.billingMonth);
    await updateInvoiceReceipt(id, { receiptFileId: fileId, receiptFileName: savedName });

    return pdfNextResponse(buffer, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate receipt";
    return jsonError(msg, 500);
  }
}
