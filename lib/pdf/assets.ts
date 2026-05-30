import fs from "fs";
import path from "path";

function publicPath(filename: string): string {
  return path.join(process.cwd(), "public", filename);
}

function toDataUri(filePath: string, mime: string): string {
  const base64 = fs.readFileSync(filePath).toString("base64");
  return `data:${mime};base64,${base64}`;
}

export function getLogoDataUri(): string {
  const logoPath = publicPath("logo-full-dark.png");
  if (!fs.existsSync(logoPath)) {
    throw new Error("Missing public/logo-full-dark.png");
  }
  return toDataUri(logoPath, "image/png");
}

export function getPaynowQrPlaceholderDataUri(): string {
  const path = publicPath("paynow-qr-placeholder.png");
  if (!fs.existsSync(path)) {
    throw new Error("Missing public/paynow-qr-placeholder.png");
  }
  return toDataUri(path, "image/png");
}
