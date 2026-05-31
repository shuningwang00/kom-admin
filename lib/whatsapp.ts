import type { ContactType } from "@/lib/contacts";
import { BUSINESS } from "@/lib/config";

export function parsePhoneFromContact(contact: string): string | null {
  const digits = contact.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("65") && digits.length >= 10) return digits;
  if (digits.length === 8) return `65${digits}`;
  if (digits.length >= 10) return digits;
  return null;
}

export function buildInvoiceWhatsAppMessage(opts: {
  studentName: string;
  monthLabel: string;
  sessionCount: number;
  amount: number;
  paymentReference: string;
  invoiceNumber: string;
}): string {
  const amount = opts.amount.toFixed(2);
  return [
    `Hi,`,
    ``,
    `Knockout Math invoice for *${opts.studentName}* — *${opts.monthLabel}*.`,
    ``,
    `Invoice: ${opts.invoiceNumber}`,
    `Sessions: ${opts.sessionCount}`,
    `Amount: S$${amount}`,
    `PayNow reference: *${opts.paymentReference}*`,
    ``,
    `Please find the invoice PDF attached below (or use the link we share). Thank you!`,
    ``,
    `${BUSINESS.name}`,
    `${BUSINESS.phone}`,
  ].join("\n");
}

export function buildReceiptWhatsAppMessage(opts: {
  studentName: string;
  monthLabel: string;
  amount: number;
  receiptNo: string;
}): string {
  return [
    `Hi,`,
    ``,
    `Payment received for *${opts.studentName}* — *${opts.monthLabel}*.`,
    ``,
    `Amount: S$${opts.amount.toFixed(2)}`,
    `Receipt: ${opts.receiptNo}`,
    ``,
    `Thank you!`,
    `${BUSINESS.name}`,
  ].join("\n");
}

export function buildFamilyInvoiceWhatsAppMessage(opts: {
  familyLabel: string;
  monthLabel: string;
  lines: Array<{ studentName: string; sessionCount: number; amount: number }>;
  totalAmount: number;
  paymentReference: string;
  invoiceNumber: string;
}): string {
  const lineText = opts.lines
    .map(
      (l) =>
        `• *${l.studentName}*: ${l.sessionCount} session(s), S$${l.amount.toFixed(2)}`,
    )
    .join("\n");

  return [
    `Hi,`,
    ``,
    `Knockout Math invoice for *${opts.familyLabel}* — *${opts.monthLabel}*.`,
    ``,
    `Invoice: ${opts.invoiceNumber}`,
    lineText,
    ``,
    `*Total: S$${opts.totalAmount.toFixed(2)}*`,
    `PayNow reference: *${opts.paymentReference}*`,
    ``,
    `Please find the invoice PDF(s) attached below. Thank you!`,
    ``,
    `${BUSINESS.name}`,
    `${BUSINESS.phone}`,
  ].join("\n");
}

export function whatsAppDeepLink(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function buildMakeupReminderWhatsAppMessage(opts: {
  studentName: string;
  primaryContactType: ContactType | null;
  dateTimeLabel: string;
}): string {
  const when = opts.dateTimeLabel.trim();
  if (opts.primaryContactType === "student") {
    return `Hello! Please be reminded of your make-up class on ${when}.`;
  }
  const name = opts.studentName.trim() || "your child";
  return `Hello! Please be reminded of ${name}'s make-up class on ${when}.`;
}
