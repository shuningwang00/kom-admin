import type { BillableSession } from "@/lib/types";

export function formatSessionLine(session: BillableSession): string {
  const base = `${session.dateLabel} · ${session.sheetName} · ${session.classLabel}`;
  if (session.cellType === "makeup_done" && session.makeupNote) {
    return `${base} (${session.makeupNote})`;
  }
  return base;
}

export function formatMoney(amount: number): string {
  return `S$${amount.toFixed(2)}`;
}

const SG_DATE: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

export function formatInvoiceDates(issueDate: Date = new Date()) {
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 5);
  return {
    issuedAt: issueDate.toLocaleDateString("en-SG", SG_DATE),
    dueAt: dueDate.toLocaleDateString("en-SG", SG_DATE),
  };
}

export function formatProductLine(
  level: string,
  time: string,
  tutor: string,
  classLabel: string,
): string {
  if (classLabel.trim()) return classLabel.trim();
  return [level, time, tutor].filter(Boolean).join(" ").trim();
}

/** e.g. Sec 2 Math (Monday) — no tutor */
export function formatInvoiceProduct(level: string, day: string): string {
  const l = level.trim();
  const d = day.trim();
  let name = l;
  if (!/math|h2|h1|e\s*math|a\s*math/i.test(l)) {
    name = `${l} Math`;
  }
  return d ? `${name} (${d})` : name;
}

export function formatSessionDateLabel(session: BillableSession): string {
  if (
    (session.cellType === "makeup_done" ||
      session.cellType === "makeup_scheduled") &&
    session.makeupNote
  ) {
    const m = session.makeupNote.match(/(\d{1,2}\/\d{1,2})/);
    if (m) return `${m[1]} (make-up)`;
  }
  return session.dateLabel;
}

/** Billable session dates only (waived sessions are not in this list). */
export function formatSessionDatesDescription(
  sessions: BillableSession[],
): string {
  if (sessions.length === 0) return "";
  return sessions.map(formatSessionDateLabel).join(", ");
}
