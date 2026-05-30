import { assertCanUseBilling } from "@/lib/auth/access";
import { jsonError } from "@/lib/api/json";
import { writeInvoiceMarker } from "@/lib/sheets/client";
import type { StudentBillingRow } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    await assertCanUseBilling();
    const body = await request.json();
    const spreadsheetId = String(body.spreadsheetId ?? "").trim();
    const invoiceNumber = String(body.invoiceNumber ?? "").trim();
    const row = body.row as StudentBillingRow | undefined;

    if (
      !spreadsheetId ||
      !invoiceNumber ||
      !row?.sheetName ||
      !row?.rowIndex ||
      row.invColumnIndex == null
    ) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    await writeInvoiceMarker(spreadsheetId, row, invoiceNumber);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("mark invoice error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to update sheet.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
