import { NextResponse } from "next/server";

/** Next.js BodyInit typing does not include Node Buffer; copy into Uint8Array. */
export function pdfNextResponse(
  buffer: Buffer,
  headers: Record<string, string>,
): NextResponse {
  return new NextResponse(new Uint8Array(buffer), { headers });
}
