import { renderToBuffer } from "@react-pdf/renderer";
import { getLogoDataUri, getPaynowQrPlaceholderDataUri } from "@/lib/pdf/assets";
import { InvoiceDocument, type InvoicePdfProps } from "@/lib/pdf/invoice-document";
import { ReceiptDocument, type ReceiptPdfProps } from "@/lib/pdf/receipt-document";
import { DbInvoiceDocument, type DbInvoicePdfProps } from "@/lib/pdf/db-invoice-document";
import { DbReceiptDocument, type DbReceiptPdfProps } from "@/lib/pdf/db-receipt-document";

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

export async function renderDbInvoicePdf(
  props: Omit<DbInvoicePdfProps, "logoSrc" | "paynowQrPlaceholderSrc">,
): Promise<Buffer> {
  const element = DbInvoiceDocument({
    ...props,
    logoSrc: getLogoDataUri(),
    paynowQrPlaceholderSrc: getPaynowQrPlaceholderDataUri(),
  });
  return toNodeBuffer(await renderToBuffer(element));
}

export async function renderDbReceiptPdf(
  props: Omit<DbReceiptPdfProps, "logoSrc">,
): Promise<Buffer> {
  const element = DbReceiptDocument({ ...props, logoSrc: getLogoDataUri() });
  return toNodeBuffer(await renderToBuffer(element));
}

function toNodeBuffer(data: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}
