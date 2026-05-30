import {
  classifyAttendanceCell,
  extractBackground,
} from "@/lib/sheets/cell-rules";
import { parseClassHeader } from "@/lib/sheets/parse-class-header";
import {
  cellText,
  detectColumnHeaderRow,
  getRowLabel,
  isClassHeaderRow,
  isSupplementalHeaderRow,
  mergeTrailingColumnHeaders,
  normalizePaymentStatus,
} from "@/lib/sheets/row-utils";
import {
  isRegistrationFeeDue,
  REGISTRATION_FEE_AMOUNT,
} from "@/lib/billing/registration-fee";
import { getDefaultRatePerSession } from "@/lib/config";
import type { BillableSession, StudentBillingRow } from "@/lib/types";

import type { GridCell } from "@/lib/sheets/row-utils";

type GridRow = { values?: GridCell[] };

type SheetGrid = {
  properties?: { title?: string };
  data?: Array<{ rowData?: GridRow[] }>;
};

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function isStudentNameRow(
  values: GridCell[],
  colMap: Record<string, number>,
): string | null {
  const nameCol = colMap.name;
  if (nameCol === undefined) return null;
  const name = cellText(values[nameCol]);
  if (!name || /^name$/i.test(name)) return null;
  if (name.length < 2) return null;
  const beforeCol = 8;
  if (isClassHeaderRow(values, beforeCol)) return null;
  return name;
}

function computeAmount(sessionCount: number, amountPayable: number | null) {
  const warnings: string[] = [];
  const defaultRate = getDefaultRatePerSession();

  if (amountPayable != null && sessionCount > 0) {
    const implied = Math.round((amountPayable / sessionCount) * 100) / 100;
    const fromSessions = sessionCount * implied;
    if (Math.abs(fromSessions - amountPayable) > 0.02) {
      warnings.push(
        `Amount $${amountPayable} ≠ ${sessionCount} × $${implied}`,
      );
    }
    return {
      computedAmount: amountPayable,
      ratePerSession: implied,
      warnings,
    };
  }

  if (amountPayable != null) {
    return {
      computedAmount: amountPayable,
      ratePerSession: defaultRate,
      warnings,
    };
  }

  return {
    computedAmount: sessionCount * defaultRate,
    ratePerSession: defaultRate,
    warnings:
      sessionCount > 0
        ? [`Using default $${defaultRate}/session — set Amount Payable on sheet`]
        : [],
  };
}

export function parseSheetGrid(sheet: SheetGrid): StudentBillingRow[] {
  const sheetName = sheet.properties?.title ?? "Sheet";
  const rows = sheet.data?.[0]?.rowData ?? [];
  const results: StudentBillingRow[] = [];
  let parsedClass = parseClassHeader("");
  let colMap: Record<string, number> = {};
  let dateColumns: Array<{ colIndex: number; label: string }> = [];
  let tableReady = false;

  const labelBeforeCol = () =>
    dateColumns.length > 0 ? dateColumns[0].colIndex : 8;

  for (let r = 0; r < rows.length; r++) {
    const values = rows[r].values ?? [];
    const beforeCol = labelBeforeCol();

    const header = detectColumnHeaderRow(values);
    if (header) {
      if (r > 0) {
        const prev = rows[r - 1].values ?? [];
        if (isSupplementalHeaderRow(prev)) {
          mergeTrailingColumnHeaders(header.colMap, prev);
        }
      }
      colMap = header.colMap;
      dateColumns = header.dateColumns;
      tableReady = true;
      continue;
    }

    if (isClassHeaderRow(values, beforeCol)) {
      const label = getRowLabel(values, beforeCol);
      parsedClass = parseClassHeader(label);
      continue;
    }

    if (!tableReady) continue;

    const studentName = isStudentNameRow(values, colMap);
    if (!studentName) continue;

    const sessions: BillableSession[] = [];
    for (const { colIndex, label } of dateColumns) {
      const cell = values[colIndex];
      const value = cellText(cell);
      if (!value) continue;
      const classified = classifyAttendanceCell(
        value,
        extractBackground(cell?.effectiveFormat),
      );
      if (!classified.billable) continue;
      sessions.push({
        dateLabel: label,
        lessonDate: label,
        classLabel: parsedClass.full,
        sheetName,
        cellType: classified.cellType,
        makeupNote: classified.makeupNote,
      });
    }

    const registrationFee = isRegistrationFeeDue(values, dateColumns)
      ? REGISTRATION_FEE_AMOUNT
      : 0;

    const amountRaw =
      colMap.amount !== undefined ? cellText(values[colMap.amount]) : "";
    const amountPayable = amountRaw ? parseMoney(amountRaw) : null;
    const { computedAmount: tuitionAmount, ratePerSession, warnings } =
      computeAmount(sessions.length, amountPayable);

    const rowWarnings = [...warnings];
    if (registrationFee > 0) {
      rowWarnings.push(
        `Registration fee $${registrationFee} (free trial → billable lesson)`,
      );
    }

    const computedAmount =
      Math.round((tuitionAmount + registrationFee) * 100) / 100;

    const rowIndex = r + 1;
    results.push({
      id: `${sheetName}!${rowIndex}!${studentName}`,
      day: sheetName,
      sheetName,
      rowIndex,
      level: parsedClass.level,
      time: parsedClass.time,
      tutor: parsedClass.tutor,
      classLabel: parsedClass.full,
      sectionLabel: parsedClass.full,
      studentName,
      contact:
        colMap.contact !== undefined ? cellText(values[colMap.contact]) : "",
      school:
        colMap.school !== undefined ? cellText(values[colMap.school]) : "",
      invMarker:
        colMap.inv !== undefined ? cellText(values[colMap.inv]) : "",
      invColumnIndex: colMap.inv ?? null,
      sessions,
      sessionCount: sessions.length,
      registrationFee,
      amountPayable,
      computedAmount,
      ratePerSession,
      paymentStatus: normalizePaymentStatus(
        colMap.payment !== undefined ? cellText(values[colMap.payment]) : "",
      ),
      paymentColumnIndex: colMap.payment ?? null,
      receiptNo:
        colMap.receipt !== undefined ? cellText(values[colMap.receipt]) : "",
      warnings:
        parsedClass.full === ""
          ? [...rowWarnings, "No class header found above this row"]
          : rowWarnings,
    });
  }

  return results;
}

export function monthLabelFromTitle(title: string): string {
  const m = title.match(/(\d{2})-(\d{4})/);
  if (!m) return title;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const idx = Number(m[1]) - 1;
  return `${months[idx] ?? m[1]} ${m[2]}`;
}

export function yearMonthFromTitle(title: string): string {
  const m = title.match(/(\d{2})-(\d{4})/);
  if (m) return `${m[2]}${m[1]}`;
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}
