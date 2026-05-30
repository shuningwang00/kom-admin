import { isPdfDevPreviewEnabled } from "@/lib/pdf/dev-preview";
import { getPdfPreviewSample, type PdfPreviewSampleId } from "@/lib/pdf/sample-data";
import { renderInvoicePdf, renderReceiptPdf } from "@/lib/pdf/render";
import { pdfNextResponse } from "@/lib/pdf/response";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SAMPLES = new Set<PdfPreviewSampleId>([
  "invoice",
  "invoice-discount",
  "invoice-registration",
  "invoice-long",
  "receipt",
]);

export async function GET(request: Request) {
  if (!isPdfDevPreviewEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const sample = (searchParams.get("sample") ?? "invoice") as PdfPreviewSampleId;

  if (!SAMPLES.has(sample)) {
    return NextResponse.json({ error: "Unknown sample." }, { status: 400 });
  }

  try {
    const data = getPdfPreviewSample(sample);
    const buffer =
      sample === "receipt"
        ? await renderReceiptPdf(data as Parameters<typeof renderReceiptPdf>[0])
        : await renderInvoicePdf(
            data as Parameters<typeof renderInvoicePdf>[0],
          );

    return pdfNextResponse(buffer, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="preview-${sample}.pdf"`,
      "Cache-Control": "no-store",
    });
  } catch (err) {
    console.error("dev pdf-preview error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate preview PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
