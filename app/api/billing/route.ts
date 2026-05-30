import { assertCanUseBilling } from "@/lib/auth/access";
import { jsonError } from "@/lib/api/json";
import { loadBillingFromSpreadsheet } from "@/lib/sheets/client";
import { parseSpreadsheetId } from "@/lib/sheets/spreadsheet-id";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await assertCanUseBilling();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return jsonError(message, message.includes("Billing") ? 403 : 401);
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("spreadsheetId")?.trim() ?? "";
  const spreadsheetId = parseSpreadsheetId(raw);

  if (!spreadsheetId) {
    return NextResponse.json(
      { error: "Paste a Google Sheets URL or spreadsheet ID." },
      { status: 400 },
    );
  }

  try {
    const preview = await loadBillingFromSpreadsheet(spreadsheetId);
    return NextResponse.json(preview);
  } catch (err) {
    console.error("billing load error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to load spreadsheet.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
