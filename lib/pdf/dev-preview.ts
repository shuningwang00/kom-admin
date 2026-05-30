export function isPdfDevPreviewEnabled(): boolean {
  if (process.env.ENABLE_PDF_PREVIEW === "1") return true;
  return process.env.NODE_ENV !== "production";
}
