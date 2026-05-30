import type { BillableSession } from "@/lib/types";
import type { InvoicePdfProps } from "@/lib/pdf/invoice-document";
import type { ReceiptPdfProps } from "@/lib/pdf/receipt-document";

const sampleSessions: BillableSession[] = [
  {
    dateLabel: "02/05",
    lessonDate: "2026-05-02",
    classLabel: "Sec 2 6:15-8:00PM ZI NING",
    sheetName: "Monday",
    cellType: "attended",
  },
  {
    dateLabel: "09/05",
    lessonDate: "2026-05-09",
    classLabel: "Sec 2 6:15-8:00PM ZI NING",
    sheetName: "Monday",
    cellType: "attended",
  },
  {
    dateLabel: "16/05",
    lessonDate: "2026-05-16",
    classLabel: "Sec 2 6:15-8:00PM ZI NING",
    sheetName: "Monday",
    cellType: "makeup_done",
    makeupNote: "MU on 27/05",
  },
  {
    dateLabel: "23/05",
    lessonDate: "2026-05-23",
    classLabel: "Sec 2 6:15-8:00PM ZI NING",
    sheetName: "Monday",
    cellType: "attended",
  },
];

export type PdfPreviewSampleId =
  | "invoice"
  | "invoice-discount"
  | "invoice-registration"
  | "invoice-long"
  | "receipt";

export function getPdfPreviewSample(
  id: PdfPreviewSampleId,
): Omit<InvoicePdfProps, "logoSrc" | "paynowQrPlaceholderSrc"> | Omit<ReceiptPdfProps, "logoSrc"> {
  if (id === "receipt") {
    return {
      receiptNumber: "RCP-202605-042",
      invoiceNumber: "INV-202605-042",
      studentName: "Jacob Tan",
      level: "Sec 2",
      dayLabel: "Monday",
      sessions: sampleSessions,
      sessionCount: 4,
      ratePerSession: 70,
      amount: 280,
      paidAt: "30 May 2026",
    } satisfies Omit<ReceiptPdfProps, "logoSrc">;
  }

  if (id === "invoice-discount") {
    return {
      invoiceNumber: "INV-202605-088",
      studentName: "Sarah Lim",
      level: "Sec 2",
      dayLabel: "Wednesday",
      sessions: sampleSessions.slice(0, 4),
      sessionCount: 4,
      ratePerSession: 65,
      amount: 260,
      subtotal: 280,
      discount: 20,
      issuedAt: "30 May 2026",
      dueAt: "4 June 2026",
    };
  }

  if (id === "invoice-registration") {
    return {
      invoiceNumber: "INV-202605-077",
      studentName: "Emma Chen",
      level: "Sec 2",
      dayLabel: "Tuesday",
      sessions: sampleSessions.slice(0, 3),
      sessionCount: 3,
      ratePerSession: 70,
      registrationFee: 40,
      amount: 250,
      issuedAt: "30 May 2026",
      dueAt: "4 June 2026",
    };
  }

  if (id === "invoice-long") {
    return {
      invoiceNumber: "INV-202605-099",
      studentName: "Alexandra Wong Mei Ling",
      level: "Sec 4 A Math",
      dayLabel: "Saturday",
      sessions: [
        ...sampleSessions,
        {
          dateLabel: "30/05",
          lessonDate: "2026-05-30",
          classLabel: "Sec 4 A Math 9:00-10:45AM ZI NING",
          sheetName: "Saturday",
          cellType: "attended",
        },
      ],
      sessionCount: 5,
      ratePerSession: 85,
      amount: 425,
      issuedAt: "30 May 2026",
      dueAt: "4 June 2026",
    };
  }

  return {
    invoiceNumber: "INV-202605-042",
    studentName: "Jacob Tan",
    level: "Sec 2",
    dayLabel: "Monday",
    sessions: sampleSessions,
    sessionCount: 4,
    ratePerSession: 70,
    amount: 280,
    issuedAt: "30 May 2026",
    dueAt: "4 June 2026",
  };
}

export const PDF_PREVIEW_SAMPLES: { id: PdfPreviewSampleId; label: string }[] = [
  { id: "invoice", label: "Invoice (standard)" },
  { id: "invoice-discount", label: "Invoice (with discount)" },
  { id: "invoice-registration", label: "Invoice (registration fee)" },
  { id: "invoice-long", label: "Invoice (long name + 5 sessions)" },
  { id: "receipt", label: "Receipt" },
];
