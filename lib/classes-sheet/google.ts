import {
  getClassesSheetRange,
  getClassesSpreadsheetId,
} from "@/lib/classes-sheet/config";
import { getGoogleAuthClient } from "@/lib/google/auth";
import { google } from "googleapis";

export async function fetchClassesSheetRows(): Promise<{
  rows: string[][];
  sheetTitle: string;
}> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getClassesSpreadsheetId();
  const tab = process.env.CLASSES_SHEET_TAB?.trim();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });

  const sheetTitle =
    tab || meta.data.sheets?.[0]?.properties?.title || "Sheet1";

  const rangeSpec = getClassesSheetRange();
  const cellRange = rangeSpec.includes("!")
    ? rangeSpec.split("!").pop()!
    : rangeSpec;
  const escapedTitle = sheetTitle.replace(/'/g, "''");
  const range = `'${escapedTitle}'!${cellRange}`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return {
    rows: (res.data.values as string[][]) ?? [],
    sheetTitle,
  };
}
