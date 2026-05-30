import { applyRatesToRows } from "@/lib/billing/rates";
import { columnIndexToLetter } from "@/lib/sheets/column-letter";
import { getGoogleAuthClient } from "@/lib/google/auth";
import {
  monthLabelFromTitle,
  parseSheetGrid,
  yearMonthFromTitle,
} from "@/lib/sheets/parser";
import type { BillingPreview, StudentBillingRow } from "@/lib/types";
import { google } from "googleapis";

async function getSheetsApi() {
  const auth = await getGoogleAuthClient();
  return google.sheets({ version: "v4", auth });
}

export async function loadBillingFromSpreadsheet(
  spreadsheetId: string,
): Promise<BillingPreview> {
  const sheets = await getSheetsApi();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets.properties.title",
  });

  const title = meta.data.properties?.title ?? spreadsheetId;
  const sheetTitles =
    meta.data.sheets
      ?.map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t)) ?? [];

  const allRows: StudentBillingRow[] = [];

  for (const sheetName of sheetTitles) {
    if (/^rates$/i.test(sheetName)) continue;

    const escaped = sheetName.replace(/'/g, "''");
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [`'${escaped}'!A1:Z120`],
      includeGridData: true,
      fields:
        "sheets(properties.title,data(rowData(values(formattedValue,userEnteredValue,effectiveValue,effectiveFormat.backgroundColor))))",
    });

    const sheet = res.data.sheets?.[0];
    if (!sheet) continue;
    allRows.push(...parseSheetGrid(sheet as Parameters<typeof parseSheetGrid>[0]));
  }

  const sorted = allRows.sort((a, b) => {
    const byDay = a.day.localeCompare(b.day, "en", { sensitivity: "base" });
    if (byDay !== 0) return byDay;
    return a.studentName.localeCompare(b.studentName, "en", {
      sensitivity: "base",
    });
  });

  return {
    spreadsheetId,
    spreadsheetTitle: title,
    monthLabel: monthLabelFromTitle(title),
    yearMonth: yearMonthFromTitle(title),
    rows: applyRatesToRows(sorted),
    loadedAt: new Date().toISOString(),
  };
}

export async function writeInvoiceMarker(
  spreadsheetId: string,
  row: StudentBillingRow,
  invoiceNumber: string,
): Promise<void> {
  if (row.invColumnIndex == null) {
    throw new Error(
      'No "INV" column found on this tab. Add an INV header before Receipt No.',
    );
  }

  const col = columnIndexToLetter(row.invColumnIndex);
  const sheets = await getSheetsApi();
  const escaped = row.sheetName.replace(/'/g, "''");
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${escaped}'!${col}${row.rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[invoiceNumber]] },
  });
}
