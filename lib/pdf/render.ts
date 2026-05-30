import { renderToBuffer } from "@react-pdf/renderer";
import { getLogoDataUri, getPaynowQrPlaceholderDataUri } from "@/lib/pdf/assets";
import { InvoiceDocument, type InvoicePdfProps } from "@/lib/pdf/invoice-document";
import {
  ReceiptDocument,
  type ReceiptPdfProps,
} from "@/lib/pdf/receipt-document";

export async function renderInvoicePdf(
  props: Omit<InvoicePdfProps, "logoSrc" | "paynowQrPlaceholderSrc">,
): Promise<Buffer> {
  const element = InvoiceDocument({
    ...props,
    logoSrc: getLogoDataUri(),
    paynowQrPlaceholderSrc: getPaynowQrPlaceholderDataUri(),
  });

  const buffer = await renderToBuffer(element);
  return toNodeBuffer(buffer);
}

export async function renderReceiptPdf(
  props: Omit<ReceiptPdfProps, "logoSrc">,
): Promise<Buffer> {
  const element = ReceiptDocument({
    ...props,
    logoSrc: getLogoDataUri(),
  });
  const buffer = await renderToBuffer(element);
  return toNodeBuffer(buffer);
}

function toNodeBuffer(data: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}
