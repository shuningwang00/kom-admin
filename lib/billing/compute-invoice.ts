import { and, asc, desc, eq, inArray, isNull, lt, lte, gte, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  attendanceRecords,
  classes,
  classSessions,
  enrollments,
  invoiceLineItems,
  invoiceStudents,
  invoices,
  pendingCredits,
  studentRateOverrides,
  students,
} from "@/lib/db/schema";
import { LESSON_RATES, parseSection } from "@/lib/billing/rates";
import { REGISTRATION_FEE_AMOUNT } from "@/lib/billing/registration-fee";
import { parseMakeupDateFromNote } from "@/lib/attendance/status";
import { getDefaultRatePerSession } from "@/lib/config";

export type ComputedLineItem = {
  type: "tuition" | "registration_fee" | "balance_forward" | "credit" | "discount";
  studentId: string;
  studentName: string;
  attendanceRecordId?: string;
  sessionId?: string;
  classId?: string;
  classLabel: string;
  sessionDate?: string;
  description: string;
  detail: string;
  amount: number;
  sortOrder: number;
};

export type InvoicePreview = {
  studentIds: string[];
  studentNames: string[];
  contactName: string;
  billingMonth: string;
  lineItems: ComputedLineItem[];
  subtotal: number;
  balanceForward: number;
  creditAvailable: number;
  totalDue: number;
  existingInvoiceId?: string | null;
};

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

type RateOverrideRow = typeof studentRateOverrides.$inferSelect;

function resolveRate(
  overrides: RateOverrideRow[],
  classId: string,
  sessionDate: string,
  classLabel: string,
  classLevel: string,
  allClassLabels: string[],
): number {
  const applicable = overrides.filter(
    (o) =>
      (o.classId === classId || o.classId === null) &&
      (!o.validFrom || o.validFrom <= sessionDate) &&
      (!o.validTo || o.validTo >= sessionDate),
  );
  const specific = applicable.find((o) => o.classId === classId);
  const general = applicable.find((o) => o.classId === null);
  const override = specific ?? general;
  if (override) return parseFloat(override.ratePerLesson);

  const tier = parseSection(classLabel || classLevel);
  if (tier.level === "jc") return LESSON_RATES.jc;
  if (tier.level === "lower") return LESSON_RATES.lowerSecondary;
  if (tier.level === "upper") {
    const hasA = allClassLabels.some((l) => {
      const p = parseSection(l);
      return p.mentionsA && p.level === "upper";
    });
    const hasE = allClassLabels.some((l) => {
      const p = parseSection(l);
      return p.mentionsE && p.level === "upper";
    });
    if (hasA && hasE) return LESSON_RATES.upperSecondaryBundle;
    return LESSON_RATES.upperSecondary;
  }
  return getDefaultRatePerSession();
}

async function computeForStudent(
  db: ReturnType<typeof getDb>,
  studentId: string,
  studentName: string,
  billingMonth: string,
  monthStart: string,
  monthEnd: string,
  sortOrderStart: number,
): Promise<{ lineItems: ComputedLineItem[]; subtotal: number; balanceForward: number; creditAvailable: number }> {
  // Determine how far back to fetch sessions: start from the month after the last invoice.
  // If no prior invoice exists, fall back to the student's earliest enrollment start date.
  const [lastInvoiced] = await db
    .select({ billingMonth: invoices.billingMonth })
    .from(invoices)
    .innerJoin(invoiceStudents, eq(invoiceStudents.invoiceId, invoices.id))
    .where(
      and(
        eq(invoiceStudents.studentId, studentId),
        lt(invoices.billingMonth, billingMonth),
        inArray(invoices.status, ["sent", "partial", "paid"]),
      ),
    )
    .orderBy(desc(invoices.billingMonth))
    .limit(1);

  let effectiveStart: string;
  if (lastInvoiced) {
    const [ly, lm] = lastInvoiced.billingMonth.split("-").map(Number);
    const nm = lm === 12 ? 1 : lm + 1;
    const ny = lm === 12 ? ly + 1 : ly;
    effectiveStart = `${ny}-${String(nm).padStart(2, "0")}-01`;
  } else {
    const [earliestEnr] = await db
      .select({ startedAt: enrollments.startedAt })
      .from(enrollments)
      .where(eq(enrollments.studentId, studentId))
      .orderBy(asc(enrollments.startedAt))
      .limit(1);
    effectiveStart = earliestEnr?.startedAt
      ? `${earliestEnr.startedAt.substring(0, 7)}-01`
      : monthStart;
  }

  const activeEnrollments = await db
    .select({
      enrollmentId: enrollments.id,
      classId: classes.id,
      classLabel: classes.label,
      classLevel: classes.level,
      registrationFeeDue: enrollments.registrationFeeDue,
      startedAt: enrollments.startedAt,
      endedAt: enrollments.endedAt,
    })
    .from(enrollments)
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        or(isNull(enrollments.startedAt), lte(enrollments.startedAt, monthEnd)),
        or(isNull(enrollments.endedAt), gte(enrollments.endedAt, effectiveStart)),
      ),
    );

  if (activeEnrollments.length === 0) {
    return { lineItems: [], subtotal: 0, balanceForward: 0, creditAvailable: 0 };
  }

  const allClassLabels = activeEnrollments.map((e) => e.classLabel);
  const classIds = activeEnrollments.map((e) => e.classId);

  const rateOverrides = await db
    .select()
    .from(studentRateOverrides)
    .where(eq(studentRateOverrides.studentId, studentId));

  const sessions = await db
    .select({
      sessionId: classSessions.id,
      classId: classSessions.classId,
      scheduledDate: classSessions.scheduledDate,
      sessionStatus: classSessions.status,
      originalDate: classSessions.originalDate,
    })
    .from(classSessions)
    .where(
      and(
        inArray(classSessions.classId, classIds),
        gte(classSessions.scheduledDate, effectiveStart),
        lt(classSessions.scheduledDate, monthEnd),
      ),
    );

  if (sessions.length === 0) {
    return { lineItems: [], subtotal: 0, balanceForward: 0, creditAvailable: 0 };
  }

  const sessionIds = sessions.map((s) => s.sessionId);
  const attendances = await db
    .select({
      id: attendanceRecords.id,
      sessionId: attendanceRecords.sessionId,
      status: attendanceRecords.status,
      makeupNote: attendanceRecords.makeupNote,
    })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        inArray(attendanceRecords.sessionId, sessionIds),
      ),
    );

  const attendanceBySession = new Map(attendances.map((a) => [a.sessionId, a]));
  const lineItems: ComputedLineItem[] = [];
  let sortOrder = sortOrderStart;

  // Dates already billed via makeup_done (classId:date) — skip present records on those dates
  const makeupDoneDates = new Set<string>();
  for (const session of sessions) {
    const att = attendanceBySession.get(session.sessionId);
    if (att?.status === "makeup_done") {
      const muDate = parseMakeupDateFromNote(att.makeupNote ?? "", session.scheduledDate);
      if (muDate) makeupDoneDates.add(`${session.classId}:${muDate}`);
    }
  }

  const classSortMap = new Map(activeEnrollments.map((e, i) => [e.classId, i]));
  sessions.sort((a, b) => {
    const ca = classSortMap.get(a.classId) ?? 999;
    const cb = classSortMap.get(b.classId) ?? 999;
    if (ca !== cb) return ca - cb;
    return a.scheduledDate.localeCompare(b.scheduledDate);
  });

  for (const session of sessions) {
    if (session.sessionStatus === "cancelled" || session.sessionStatus === "rescheduled_away") continue;

    // Skip rescheduled sessions that were already billed in a prior period
    if (session.originalDate && session.originalDate < effectiveStart) {
      const [alreadyBilled] = await db
        .select({ id: invoiceLineItems.id })
        .from(invoiceLineItems)
        .innerJoin(invoices, eq(invoices.id, invoiceLineItems.invoiceId))
        .where(
          and(
            eq(invoiceLineItems.sessionId, session.sessionId),
            inArray(invoices.status, ["sent", "partial", "paid"]),
          ),
        )
        .limit(1);
      if (alreadyBilled) continue;
    }

    const enrollment = activeEnrollments.find((e) => e.classId === session.classId);
    if (!enrollment) continue;

    // Only bill sessions within the student's enrollment period
    if (enrollment.startedAt && session.scheduledDate < enrollment.startedAt) continue;
    if (enrollment.endedAt && session.scheduledDate > enrollment.endedAt) continue;

    // Skip makeup slots already billed via makeup_done on the original session
    if (makeupDoneDates.has(`${session.classId}:${session.scheduledDate}`)) continue;

    const att = attendanceBySession.get(session.sessionId);
    const isWaived = att?.status === "waive";

    let detail = formatDate(session.scheduledDate);
    if (att?.status === "makeup_scheduled") {
      detail = `${formatDate(session.scheduledDate)} (Pending M/U)`;
    } else if (att?.status === "makeup_done") {
      const muDate = parseMakeupDateFromNote(att.makeupNote ?? "", session.scheduledDate);
      detail = `${muDate ? formatDate(muDate) : "?"} (M/U for ${formatDate(session.scheduledDate)})`;
    } else if (isWaived) {
      detail = `${formatDate(session.scheduledDate)} (Waived)`;
    }

    const rate = isWaived
      ? 0
      : resolveRate(rateOverrides, session.classId, session.scheduledDate, enrollment.classLabel, enrollment.classLevel, allClassLabels);

    lineItems.push({
      type: "tuition",
      studentId,
      studentName,
      attendanceRecordId: att?.id,
      sessionId: session.sessionId,
      classId: session.classId,
      classLabel: enrollment.classLabel,
      sessionDate: session.scheduledDate,
      description: enrollment.classLabel,
      detail,
      amount: rate,
      sortOrder: sortOrder++,
    });
  }

  // Registration fee: one per student, billed in the month their enrollment started.
  // No flag needed — every student owes one, once. Unpaid amounts carry forward via balance forward.
  const REG_FEE_CUTOFF = "2026-05-01";
  const enrollmentStartedInRange = activeEnrollments.find(
    (e) => e.startedAt && e.startedAt >= effectiveStart && e.startedAt < monthEnd && e.startedAt >= REG_FEE_CUTOFF,
  );
  if (enrollmentStartedInRange) {
    const alreadyBilled = await db
      .select({ id: invoiceLineItems.id })
      .from(invoiceLineItems)
      .innerJoin(invoiceStudents, eq(invoiceLineItems.invoiceId, invoiceStudents.invoiceId))
      .innerJoin(invoices, eq(invoices.id, invoiceStudents.invoiceId))
      .where(
        and(
          eq(invoiceStudents.studentId, studentId),
          eq(invoiceLineItems.studentId, studentId),
          eq(invoiceLineItems.type, "registration_fee"),
          inArray(invoices.status, ["sent", "partial", "paid"]),
        ),
      )
      .limit(1);

    if (alreadyBilled.length === 0) {
      lineItems.push({
        type: "registration_fee",
        studentId,
        studentName,
        classId: enrollmentStartedInRange.classId,
        classLabel: enrollmentStartedInRange.classLabel,
        description: "Registration and Material Fee",
        detail: "",
        amount: REGISTRATION_FEE_AMOUNT,
        sortOrder: sortOrder++,
      });
    }
  }

  // Balance forward: all prior months with outstanding balances
  let balanceForward = 0;
  const priorInvoices = await db
    .select({ id: invoices.id, totalDue: invoices.totalDue, totalPaid: invoices.totalPaid, status: invoices.status, billingMonth: invoices.billingMonth })
    .from(invoices)
    .innerJoin(invoiceStudents, eq(invoiceStudents.invoiceId, invoices.id))
    .where(
      and(
        eq(invoiceStudents.studentId, studentId),
        inArray(invoices.status, ["sent", "partial"]),
      ),
    );

  for (const inv of priorInvoices) {
    if (inv.billingMonth >= billingMonth) continue;
    const outstanding = Math.round((parseFloat(inv.totalDue) - parseFloat(inv.totalPaid)) * 100) / 100;
    if (outstanding > 0) balanceForward += outstanding;
  }
  balanceForward = Math.round(balanceForward * 100) / 100;

  if (balanceForward > 0) {
    lineItems.push({
      type: "balance_forward",
      studentId,
      studentName,
      classLabel: "",
      description: "Balance forward",
      detail: "",
      amount: balanceForward,
      sortOrder: sortOrder++,
    });
  }

  // Credits
  const credits = await db
    .select({ id: pendingCredits.id, amount: pendingCredits.amount })
    .from(pendingCredits)
    .where(and(eq(pendingCredits.studentId, studentId), isNull(pendingCredits.appliedAt)));

  let creditAvailable = 0;
  for (const c of credits) creditAvailable += parseFloat(c.amount);
  creditAvailable = Math.round(creditAvailable * 100) / 100;

  if (creditAvailable > 0) {
    lineItems.push({
      type: "credit",
      studentId,
      studentName,
      classLabel: "",
      description: "Credit applied",
      detail: "",
      amount: -creditAvailable,
      sortOrder: sortOrder++,
    });
  }

  const tuitionItems = lineItems.filter((l) => l.type === "tuition" || l.type === "registration_fee");
  const subtotal = Math.round(tuitionItems.reduce((s, l) => s + l.amount, 0) * 100) / 100;

  return { lineItems, subtotal, balanceForward, creditAvailable };
}

export async function computeInvoicePreview(
  studentIds: string[],
  billingMonth: string,
): Promise<InvoicePreview> {
  const db = getDb();
  const monthStart = `${billingMonth}-01`;
  const [y, m] = billingMonth.split("-").map(Number);
  const nextMonthStr = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const monthEnd = `${nextMonthStr}-01`;

  // Load all students
  const studentRows = await db
    .select({ id: students.id, name: students.name, parentName: students.parentName })
    .from(students)
    .where(inArray(students.id, studentIds));

  if (studentRows.length === 0) throw new Error("No students found");

  // Sort by name for consistent ordering
  studentRows.sort((a, b) => a.name.localeCompare(b.name));

  const contactName = studentRows[0].parentName || studentRows[0].name;

  // Check for existing non-voided invoices
  const existing = await db
    .select({ invoiceId: invoiceStudents.invoiceId })
    .from(invoiceStudents)
    .innerJoin(invoices, eq(invoices.id, invoiceStudents.invoiceId))
    .where(
      and(
        inArray(invoiceStudents.studentId, studentIds),
        eq(invoiceStudents.billingMonth, billingMonth),
        inArray(invoices.status, ["sent", "partial", "paid"]),
      ),
    )
    .limit(1);

  const existingInvoiceId = existing[0]?.invoiceId ?? null;

  // Compute per student
  const allLineItems: ComputedLineItem[] = [];
  let totalSubtotal = 0;
  let totalBalanceForward = 0;
  let totalCreditAvailable = 0;
  let sortOrderBase = 0;

  for (const student of studentRows) {
    const result = await computeForStudent(db, student.id, student.name, billingMonth, monthStart, monthEnd, sortOrderBase);
    allLineItems.push(...result.lineItems);
    totalSubtotal += result.subtotal;
    totalBalanceForward += result.balanceForward;
    totalCreditAvailable += result.creditAvailable;
    sortOrderBase += result.lineItems.length;
  }

  totalSubtotal = Math.round(totalSubtotal * 100) / 100;
  totalBalanceForward = Math.round(totalBalanceForward * 100) / 100;
  totalCreditAvailable = Math.round(totalCreditAvailable * 100) / 100;
  const totalDue = Math.round((totalSubtotal + totalBalanceForward - totalCreditAvailable) * 100) / 100;

  return {
    studentIds: studentRows.map((s) => s.id),
    studentNames: studentRows.map((s) => s.name),
    contactName,
    billingMonth,
    lineItems: allLineItems,
    subtotal: totalSubtotal,
    balanceForward: totalBalanceForward,
    creditAvailable: totalCreditAvailable,
    totalDue,
    existingInvoiceId,
  };
}
