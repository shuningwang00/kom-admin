import PdfPreviewClient from "@/app/dev/pdf-preview/pdf-preview-client";
import { isPdfDevPreviewEnabled } from "@/lib/pdf/dev-preview";
import { notFound } from "next/navigation";

export default function PdfPreviewPage() {
  if (!isPdfDevPreviewEnabled()) notFound();
  return <PdfPreviewClient />;
}
