export type Rgb = { red: number; green: number; blue: number };

export type SessionCellType =
  | "attended"
  | "makeup_done"
  | "makeup_scheduled"
  | "waive"
  | "trial"
  | "empty"
  | "other";

export type BillableSession = {
  dateLabel: string;
  lessonDate: string;
  classLabel: string;
  sheetName: string;
  cellType: SessionCellType;
  makeupNote?: string;
};

export type StudentBillingRow = {
  id: string;
  /** Weekday tab name (e.g. Saturday) */
  day: string;
  sheetName: string;
  rowIndex: number;
  /** From black row — e.g. Sec 2, Sec 4 A Math */
  level: string;
  /** From black row — e.g. 9:00-10:45AM */
  time: string;
  /** From black row — e.g. ZI NING */
  tutor: string;
  /** Full black row text */
  classLabel: string;
  sectionLabel: string;
  studentName: string;
  contact: string;
  school: string;
  invMarker: string;
  /** 0-based column index for INV (e.g. 10 = column K) */
  invColumnIndex: number | null;
  sessions: BillableSession[];
  sessionCount: number;
  /** S$40 when free trial precedes a billable lesson in the month. */
  registrationFee: number;
  amountPayable: number | null;
  computedAmount: number;
  ratePerSession: number;
  paymentStatus: string;
  /** 0-based column index for Payment (e.g. 7 = column H). */
  paymentColumnIndex: number | null;
  receiptNo: string;
  warnings: string[];
};

export type BillingPreview = {
  spreadsheetId: string;
  spreadsheetTitle: string;
  monthLabel: string;
  yearMonth: string;
  rows: StudentBillingRow[];
  loadedAt: string;
};
