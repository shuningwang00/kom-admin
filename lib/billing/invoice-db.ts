import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deleteFileFromDrive } from "@/lib/google/drive";
import {
  classes,
  enrollments,
  invoiceLineItems,
  invoicePayments,
  invoices,
  invoiceStudents,
  pendingCredits,
  students,
} from "@/lib/db/schema";
import { computeInvoicePreview } from "@/lib/billing/compute-invoice";
import type { InvoicePreview } from "@/lib/billing/compute-invoice";
import { parseSection } from "@/lib/billing/rates";

export type StoredInvoice = typeof invoices.$inferSelect;
export type StoredLineItem = typeof invoiceLineItems.$inferSelect;
export type StoredPayment = typeof invoicePayments.$inferSelect;

export type InvoiceDetail = StoredInvoice & {
  lineItems: StoredLineItem[];
  payments: StoredPayment[];
  studentNames: string[];
  contactName: string;
  studentEntries: Array<{ studentId: string; studentName: string }>;
};

export type DashboardStudentRow = {
  studentIds: string[];
  studentNames: string[];
  contactName: string;
  parentName: string | null;
  billingGroupId: string | null;
  level: string;
  enrolledClasses: Array<{ studentId: string; classId: string; classLabel: string }>;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  subtotal: string | null;
  totalDue: string | null;
  totalPaid: string | null;
  estimatedTotal: string | null;
  pdfFileId: string | null;
  receiptFileId: string | null;
  billingMonth: string;
};

function broadLevel(classLabel: string): string {
  const tier = parseSection(classLabel).level;
  if (tier === "jc") return "JC";
  if (tier === "upper") return "Upper Sec";
  if (tier === "lower") return "Lower Sec";
  return classLabel || "Other";
}

function groupLevel(classLabels: string[]): string {
  const levels = classLabels.map(broadLevel);
  if (levels.includes("JC")) return "JC";
  if (levels.includes("Upper Sec")) return "Upper Sec";
  if (levels.includes("Lower Sec")) return "Lower Sec";
  return levels[0] || "Other";
}

/** e.g. "INV2026050001" */
export async function nextInvoiceNumber(billingMonth: string): Promise<string> {
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(eq(invoices.billingMonth, billingMonth));
  const seq = Number(count) + 1;
  const monthCompact = billingMonth.replace("-", ""); // "2026-05" → "202605"
  return `INV${monthCompact}${String(seq).padStart(4, "0")}`;
}

/** Commit a preview to the DB as a new invoice. All writes are atomic. */
export async function createInvoice(
  preview: InvoicePreview,
  opts: {
    discountAmount?: number;
    remarks?: string;
    createdBy: string;
  },
): Promise<StoredInvoice> {
  const db = getDb();
  const discount = opts.discountAmount ?? 0;
  const totalDue = Math.max(0, Math.round((preview.totalDue - discount) * 100) / 100);
  const invoiceNumber = await nextInvoiceNumber(preview.billingMonth);

  return db.transaction(async (tx) => {
    const [invoice] = await tx
      .insert(invoices)
      .values({
        studentId: preview.studentIds[0],
        billingMonth: preview.billingMonth,
        invoiceNumber,
        status: "draft",
        subtotal: preview.subtotal.toFixed(2),
        discountAmount: discount.toFixed(2),
        balanceForward: preview.balanceForward.toFixed(2),
        creditApplied: preview.creditAvailable.toFixed(2),
        totalDue: totalDue.toFixed(2),
        totalPaid: "0.00",
        remarks: opts.remarks ?? "",
        createdBy: opts.createdBy,
        sentAt: new Date(),
      })
      .returning();

    // Remove stale junction rows from any previously voided invoices
    await tx.delete(invoiceStudents).where(
      and(
        inArray(invoiceStudents.studentId, preview.studentIds),
        eq(invoiceStudents.billingMonth, preview.billingMonth),
      ),
    );

    await tx.insert(invoiceStudents).values(
      preview.studentIds.map((studentId) => ({
        invoiceId: invoice.id,
        studentId,
        billingMonth: preview.billingMonth,
      })),
    );

    if (preview.lineItems.length > 0) {
      await tx.insert(invoiceLineItems).values(
        preview.lineItems.map((item) => ({
          invoiceId: invoice.id,
          type: item.type,
          studentId: item.studentId ?? null,
          attendanceRecordId: item.attendanceRecordId ?? null,
          sessionId: item.sessionId ?? null,
          classId: item.classId ?? null,
          classLabel: item.classLabel,
          sessionDate: item.sessionDate ?? null,
          description: item.description,
          detail: item.detail,
          amount: item.amount.toFixed(2),
          sortOrder: item.sortOrder,
        })),
      );
    }

    for (const item of preview.lineItems.filter((l) => l.type === "registration_fee")) {
      if (!item.classId || !item.studentId) continue;
      await tx
        .update(enrollments)
        .set({ registrationFeeDue: false })
        .where(
          and(
            eq(enrollments.studentId, item.studentId),
            eq(enrollments.classId, item.classId),
          ),
        );
    }

    for (const studentId of preview.studentIds) {
      await tx
        .update(pendingCredits)
        .set({ appliedAt: new Date(), appliedToInvoiceId: invoice.id })
        .where(
          and(
            eq(pendingCredits.studentId, studentId),
            isNull(pendingCredits.appliedAt),
          ),
        );
    }

    return invoice;
  });
}

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const db = getDb();
  const [inv] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!inv) return null;

  const [lineItemRows, paymentRows, studentEntryRows] = await Promise.all([
    db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, id))
      .orderBy(invoiceLineItems.sortOrder),
    db
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, id))
      .orderBy(invoicePayments.createdAt),
    db
      .select({
        studentId: invoiceStudents.studentId,
        studentName: students.name,
        parentName: students.parentName,
      })
      .from(invoiceStudents)
      .innerJoin(students, eq(invoiceStudents.studentId, students.id))
      .where(eq(invoiceStudents.invoiceId, id))
      .orderBy(students.name),
  ]);

  const studentNames = studentEntryRows.map((r) => r.studentName);
  const contactName = studentEntryRows[0]?.studentName || "";

  return {
    ...inv,
    lineItems: lineItemRows,
    payments: paymentRows,
    studentNames,
    contactName,
    studentEntries: studentEntryRows.map((r) => ({ studentId: r.studentId, studentName: r.studentName })),
  };
}

export async function listBillingDashboard(
  billingMonth: string,
): Promise<DashboardStudentRow[]> {
  const db = getDb();
  const monthStart = `${billingMonth}-01`;
  const [iy, im] = billingMonth.split("-").map(Number);
  const nextMonthStr = im === 12 ? `${iy + 1}-01` : `${iy}-${String(im + 1).padStart(2, "0")}`;
  const monthEnd = `${nextMonthStr}-01`;

  // All active students with billing group info
  const activeStudents = await db
    .select({
      studentId: students.id,
      studentName: students.name,
      billingGroupId: students.billingGroupId,
      parentName: students.parentName,
    })
    .from(students)
    .where(isNull(students.archivedAt))
    .orderBy(students.name);

  if (activeStudents.length === 0) return [];
  const allStudentIds = activeStudents.map((s) => s.studentId);

  // Active enrollments with class info for this month — use level as display name
  const enrollmentRows = await db
    .select({
      studentId: enrollments.studentId,
      classId: classes.id,
      classLabel: classes.level,
      registrationFeeDue: enrollments.registrationFeeDue,
    })
    .from(enrollments)
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .where(
      and(
        inArray(enrollments.studentId, allStudentIds),
        sql`(${enrollments.startedAt} IS NULL OR ${enrollments.startedAt} <= ${monthEnd})`,
        sql`(${enrollments.endedAt} IS NULL OR ${enrollments.endedAt} >= ${monthStart})`,
      ),
    );

  const classByStudent = new Map<string, Array<{ classId: string; classLabel: string; registrationFeeDue: boolean }>>();
  for (const row of enrollmentRows) {
    if (!classByStudent.has(row.studentId)) classByStudent.set(row.studentId, []);
    classByStudent.get(row.studentId)!.push({ classId: row.classId, classLabel: row.classLabel, registrationFeeDue: row.registrationFeeDue });
  }

  // Invoices for this month via invoice_students junction
  const isRows = await db
    .select({ invoiceId: invoiceStudents.invoiceId, studentId: invoiceStudents.studentId })
    .from(invoiceStudents)
    .where(and(inArray(invoiceStudents.studentId, allStudentIds), eq(invoiceStudents.billingMonth, billingMonth)));

  const invoiceIdByStudent = new Map(isRows.map((r) => [r.studentId, r.invoiceId]));

  // Fallback: pick up invoices created before invoice_students was introduced
  if (allStudentIds.length > 0) {
    const legacyRows = await db
      .select({ id: invoices.id, studentId: invoices.studentId })
      .from(invoices)
      .where(
        and(
          inArray(invoices.studentId, allStudentIds),
          eq(invoices.billingMonth, billingMonth),
        ),
      );
    for (const r of legacyRows) {
      if (r.studentId && !invoiceIdByStudent.has(r.studentId)) {
        invoiceIdByStudent.set(r.studentId, r.id);
      }
    }
  }

  let invoiceById = new Map<string, StoredInvoice>();
  const invoiceIds = [...new Set(invoiceIdByStudent.values())];
  if (invoiceIds.length > 0) {
    const invRows = await db.select().from(invoices).where(inArray(invoices.id, invoiceIds));
    invoiceById = new Map(invRows.map((inv) => [inv.id, inv]));
  }

  // Group students by billingGroupId (null → solo row per student)
  const groups = new Map<string, typeof activeStudents>();
  for (const s of activeStudents) {
    const key = s.billingGroupId ?? `solo:${s.studentId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  // Build group list first, then compute estimates in parallel
  const groupList: Array<{
    key: string;
    billingGroupId: string | null;
    studentsWithClasses: typeof activeStudents;
    studentIds: string[];
    studentNames: string[];
    allClasses: Array<{ studentId: string; classId: string; classLabel: string; registrationFeeDue: boolean }>;
    inv: StoredInvoice | null;
  }> = [];

  for (const [key, groupStudents] of groups) {
    const isSolo = key.startsWith("solo:");
    const billingGroupId = isSolo ? null : key;
    const studentsWithClasses = groupStudents.filter((s) => (classByStudent.get(s.studentId) ?? []).length > 0);
    if (studentsWithClasses.length === 0) continue;

    const studentIds = studentsWithClasses.map((s) => s.studentId);
    const studentNames = studentsWithClasses.map((s) => s.studentName);
    const allClasses = studentsWithClasses.flatMap((s) =>
      (classByStudent.get(s.studentId) ?? []).map((c) => ({ studentId: s.studentId, ...c })),
    );
    const invoiceId = studentIds.map((id) => invoiceIdByStudent.get(id)).find(Boolean) ?? null;
    const inv = invoiceId ? (invoiceById.get(invoiceId) ?? null) : null;

    groupList.push({ key, billingGroupId, studentsWithClasses, studentIds, studentNames, allClasses, inv });
  }

  // For uninvoiced groups, compute estimated total using the same logic as the INV preview
  const estimatedTotals = await Promise.all(
    groupList.map(async (g) => {
      if (g.inv) return null;
      try {
        const preview = await computeInvoicePreview(g.studentIds, billingMonth);
        return preview.totalDue > 0 ? preview.totalDue.toFixed(2) : null;
      } catch {
        return null;
      }
    }),
  );

  // Build parentName map: studentId → parentName (null if none)
  const parentNameByStudentId = new Map(activeStudents.map((s) => [s.studentId, s.parentName ?? null]));

  const results: DashboardStudentRow[] = groupList.map((g, i) => {
    const firstStudentParent = parentNameByStudentId.get(g.studentsWithClasses[0]?.studentId ?? "") ?? null;
    return {
    studentIds: g.studentIds,
    studentNames: g.studentNames,
    contactName: g.studentNames[0] || "",
    parentName: firstStudentParent || null,
    billingGroupId: g.billingGroupId,
    level: groupLevel(g.allClasses.map((c) => c.classLabel)),
    enrolledClasses: g.allClasses.map((c) => ({ studentId: c.studentId, classId: c.classId, classLabel: c.classLabel })),
    invoiceId: g.inv?.id ?? null,
    invoiceNumber: g.inv?.invoiceNumber ?? null,
    invoiceStatus: g.inv?.status ?? null,
    subtotal: g.inv?.subtotal ?? null,
    totalDue: g.inv?.totalDue ?? null,
    totalPaid: g.inv?.totalPaid ?? null,
    estimatedTotal: estimatedTotals[i],
    pdfFileId: g.inv?.pdfFileId ?? null,
    receiptFileId: g.inv?.receiptFileId ?? null,
    billingMonth,
    };
  });

  return results;
}

export async function recordPayment(
  invoiceId: string,
  payment: { amount: number; paymentDate: string; notes?: string; recordedBy: string },
): Promise<StoredInvoice> {
  const db = getDb();
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv) throw new Error("Invoice not found");

  const newPaid = Math.round((parseFloat(inv.totalPaid) + payment.amount) * 100) / 100;
  const totalDue = parseFloat(inv.totalDue);
  const overpaid = Math.round((newPaid - totalDue) * 100) / 100;
  const newStatus: StoredInvoice["status"] =
    newPaid >= totalDue - 0.005 ? "paid" : newPaid > 0 ? "partial" : "sent";
  const now = new Date();

  // Resolve credit student for overpayment before starting transaction
  let creditStudentId: string | null = inv.studentId;
  if (overpaid > 0.005 && !creditStudentId) {
    const [firstStudent] = await db
      .select({ studentId: invoiceStudents.studentId })
      .from(invoiceStudents)
      .where(eq(invoiceStudents.invoiceId, invoiceId))
      .limit(1);
    creditStudentId = firstStudent?.studentId ?? null;
  }

  const updated = await db.transaction(async (tx) => {
    await tx.insert(invoicePayments).values({
      invoiceId,
      amount: payment.amount.toFixed(2),
      paymentDate: payment.paymentDate,
      notes: payment.notes ?? "",
      recordedBy: payment.recordedBy,
    });

    const [result] = await tx
      .update(invoices)
      .set({
        totalPaid: newPaid.toFixed(2),
        status: newStatus,
        paidAt: newStatus === "paid" ? now : inv.paidAt,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoiceId))
      .returning();

    if (overpaid > 0.005 && creditStudentId) {
      await tx.insert(pendingCredits).values({
        studentId: creditStudentId,
        amount: overpaid.toFixed(2),
        reason: `Overpayment on ${inv.invoiceNumber}`,
        sourceInvoiceId: invoiceId,
      });
    }

    return result;
  });

  return updated;
}

async function reconcileOverpaymentCredit(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  invoiceId: string,
  invoiceNumber: string,
  newPaid: number,
  totalDue: number,
  studentId: string | null,
): Promise<void> {
  // Remove any unapplied overpayment credits from this invoice
  await tx
    .delete(pendingCredits)
    .where(and(eq(pendingCredits.sourceInvoiceId, invoiceId), isNull(pendingCredits.appliedAt)));

  const overpaid = Math.round((newPaid - totalDue) * 100) / 100;
  if (overpaid > 0.005 && studentId) {
    await tx.insert(pendingCredits).values({
      studentId,
      amount: overpaid.toFixed(2),
      reason: `Overpayment on ${invoiceNumber}`,
      sourceInvoiceId: invoiceId,
    });
  }
}

export async function updatePayment(
  invoiceId: string,
  paymentId: string,
  patch: { amount: number; paymentDate: string; notes?: string },
): Promise<StoredInvoice> {
  const db = getDb();
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv) throw new Error("Invoice not found");

  let creditStudentId = inv.studentId;
  if (!creditStudentId) {
    const [first] = await db.select({ studentId: invoiceStudents.studentId }).from(invoiceStudents).where(eq(invoiceStudents.invoiceId, invoiceId)).limit(1);
    creditStudentId = first?.studentId ?? null;
  }

  const updated = await db.transaction(async (tx) => {
    await tx
      .update(invoicePayments)
      .set({ amount: patch.amount.toFixed(2), paymentDate: patch.paymentDate, notes: patch.notes ?? "" })
      .where(and(eq(invoicePayments.id, paymentId), eq(invoicePayments.invoiceId, invoiceId)));

    const allPayments = await tx
      .select({ amount: invoicePayments.amount })
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, invoiceId));

    const newPaid = Math.round(allPayments.reduce((s, p) => s + parseFloat(p.amount), 0) * 100) / 100;
    const totalDue = parseFloat(inv.totalDue);
    const newStatus: StoredInvoice["status"] =
      newPaid >= totalDue - 0.005 ? "paid" : newPaid > 0 ? "partial" : "sent";

    const [result] = await tx
      .update(invoices)
      .set({ totalPaid: newPaid.toFixed(2), status: newStatus, paidAt: newStatus === "paid" ? (inv.paidAt ?? new Date()) : null, receiptFileId: null, receiptFileName: null, updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId))
      .returning();

    await reconcileOverpaymentCredit(tx, invoiceId, inv.invoiceNumber, newPaid, totalDue, creditStudentId);

    return result;
  });

  return updated;
}

export async function deletePayment(invoiceId: string, paymentId: string): Promise<StoredInvoice> {
  const db = getDb();
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv) throw new Error("Invoice not found");

  let creditStudentId = inv.studentId;
  if (!creditStudentId) {
    const [first] = await db.select({ studentId: invoiceStudents.studentId }).from(invoiceStudents).where(eq(invoiceStudents.invoiceId, invoiceId)).limit(1);
    creditStudentId = first?.studentId ?? null;
  }

  const updated = await db.transaction(async (tx) => {
    await tx.delete(invoicePayments).where(and(eq(invoicePayments.id, paymentId), eq(invoicePayments.invoiceId, invoiceId)));

    const allPayments = await tx
      .select({ amount: invoicePayments.amount })
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, invoiceId));

    const newPaid = Math.round(allPayments.reduce((s, p) => s + parseFloat(p.amount), 0) * 100) / 100;
    const totalDue = parseFloat(inv.totalDue);
    const newStatus: StoredInvoice["status"] =
      newPaid >= totalDue - 0.005 ? "paid" : newPaid > 0 ? "partial" : "sent";

    const [result] = await tx
      .update(invoices)
      .set({ totalPaid: newPaid.toFixed(2), status: newStatus, paidAt: newStatus === "paid" ? (inv.paidAt ?? new Date()) : null, receiptFileId: null, receiptFileName: null, updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId))
      .returning();

    await reconcileOverpaymentCredit(tx, invoiceId, inv.invoiceNumber, newPaid, totalDue, creditStudentId);

    return result;
  });

  return updated;
}

/** Removes a line item from a finalized invoice, recalculates totals, and creates a credit if overpaid. */
async function removeLineItemAndRecalcInvoice(
  lineItemId: string,
  creditReason: (invoiceNumber: string) => string,
): Promise<void> {
  const db = getDb();

  const [lineItem] = await db
    .select({ id: invoiceLineItems.id, invoiceId: invoiceLineItems.invoiceId, studentId: invoiceLineItems.studentId, sessionId: invoiceLineItems.sessionId })
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.id, lineItemId))
    .limit(1);
  if (!lineItem) return;

  const [inv] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, lineItem.invoiceId), inArray(invoices.status, ["sent", "partial", "paid"])))
    .limit(1);
  if (!inv) return;

  await db.delete(invoiceLineItems).where(eq(invoiceLineItems.id, lineItem.id));

  const remaining = await db
    .select({ amount: invoiceLineItems.amount, type: invoiceLineItems.type })
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, inv.id));

  const newSubtotal = Math.round(
    remaining
      .filter((l) => l.type === "tuition" || l.type === "registration_fee")
      .reduce((s, l) => s + parseFloat(l.amount), 0) * 100,
  ) / 100;

  const newTotalDue = Math.max(
    0,
    Math.round(
      (newSubtotal - parseFloat(inv.discountAmount) + parseFloat(inv.balanceForward) - parseFloat(inv.creditApplied)) * 100,
    ) / 100,
  );

  const paid = parseFloat(inv.totalPaid);
  const overpaid = Math.round((paid - newTotalDue) * 100) / 100;
  const newStatus: StoredInvoice["status"] =
    paid >= newTotalDue - 0.005 ? "paid" : paid > 0 ? "partial" : "sent";

  await db
    .update(invoices)
    .set({ subtotal: newSubtotal.toFixed(2), totalDue: newTotalDue.toFixed(2), status: newStatus, updatedAt: new Date() })
    .where(eq(invoices.id, inv.id));

  if (overpaid > 0.005) {
    const creditStudentId = lineItem.studentId ?? inv.studentId;
    await db.insert(pendingCredits).values({
      studentId: creditStudentId,
      amount: overpaid.toFixed(2),
      reason: creditReason(inv.invoiceNumber),
      sourceInvoiceId: inv.id,
      sourceSessionId: lineItem.sessionId ?? null,
    });
  }
}

/** Deletes unapplied credits that were created when a specific session was cancelled or waived. */
export async function reverseSessionCredits(sessionId: string): Promise<void> {
  await getDb()
    .delete(pendingCredits)
    .where(
      and(
        eq(pendingCredits.sourceSessionId, sessionId),
        isNull(pendingCredits.appliedAt),
      ),
    );
}

/** Called from the attendance save path when a status changes to "waive". */
export async function handleWaivedSession(
  attendanceRecordId: string | undefined,
  sessionId?: string,
  studentId?: string,
): Promise<void> {
  const db = getDb();

  // Primary lookup: by attendanceRecordId (skip when no prior record existed)
  let [lineItem] = attendanceRecordId
    ? await db
        .select({ id: invoiceLineItems.id })
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.attendanceRecordId, attendanceRecordId))
        .limit(1)
    : [];

  // Fallback: by sessionId + studentId (sessions billed before attendance was marked)
  if (!lineItem && sessionId && studentId) {
    [lineItem] = await db
      .select({ id: invoiceLineItems.id })
      .from(invoiceLineItems)
      .innerJoin(invoices, eq(invoices.id, invoiceLineItems.invoiceId))
      .where(
        and(
          eq(invoiceLineItems.sessionId, sessionId),
          eq(invoiceLineItems.studentId, studentId),
          inArray(invoices.status, ["sent", "partial", "paid"]),
        ),
      )
      .limit(1);
  }

  if (!lineItem) return;
  await removeLineItemAndRecalcInvoice(lineItem.id, (inv) => `Waived session on ${inv}`);
}

/** Called when a session is cancelled — creates credits for each student already billed. */
export async function handleCancelledSessionBilling(
  sessionId: string,
  studentIds: string[],
): Promise<void> {
  if (studentIds.length === 0) return;
  const db = getDb();

  const lineItems = await db
    .select({ id: invoiceLineItems.id, studentId: invoiceLineItems.studentId })
    .from(invoiceLineItems)
    .innerJoin(invoices, eq(invoices.id, invoiceLineItems.invoiceId))
    .where(
      and(
        eq(invoiceLineItems.sessionId, sessionId),
        inArray(invoiceLineItems.studentId, studentIds),
        inArray(invoices.status, ["sent", "partial", "paid"]),
      ),
    );

  for (const lineItem of lineItems) {
    await removeLineItemAndRecalcInvoice(lineItem.id, (inv) => `Cancelled session on ${inv}`);
  }
}

export async function markInvoiceSent(invoiceId: string): Promise<void> {
  await getDb()
    .update(invoices)
    .set({ status: "sent", updatedAt: new Date() })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.status, "draft")));
}

export async function updateInvoicePdf(
  invoiceId: string,
  data: { pdfFileId: string; pdfFileName: string },
): Promise<void> {
  await getDb().update(invoices).set({ ...data, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
}

export async function updateInvoiceReceipt(
  invoiceId: string,
  data: { receiptFileId: string; receiptFileName: string },
): Promise<void> {
  await getDb().update(invoices).set({ ...data, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
}

export async function clearInvoiceReceipt(invoiceId: string): Promise<string | null> {
  const db = getDb();
  const [inv] = await db.select({ receiptFileId: invoices.receiptFileId }).from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv) return null;
  await db.update(invoices).set({ receiptFileId: null, receiptFileName: null, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
  return inv.receiptFileId ?? null;
}

export async function voidInvoice(invoiceId: string, voidedBy: string): Promise<void> {
  const db = getDb();

  const [inv] = await db.select({ pdfFileId: invoices.pdfFileId, receiptFileId: invoices.receiptFileId })
    .from(invoices).where(eq(invoices.id, invoiceId));

  await db
    .update(invoices)
    .set({ status: "void", voidedAt: new Date(), voidedBy, pdfFileId: null, receiptFileId: null, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));

  // Remove junction rows so the dashboard shows INV again and a new invoice can be created
  await db.delete(invoiceStudents).where(eq(invoiceStudents.invoiceId, invoiceId));

  // Restore any credits that were applied to this invoice
  await db
    .update(pendingCredits)
    .set({ appliedAt: null, appliedToInvoiceId: null })
    .where(eq(pendingCredits.appliedToInvoiceId, invoiceId));

  // Delete Drive files (best-effort)
  if (inv?.pdfFileId) await deleteFileFromDrive(inv.pdfFileId).catch(() => {});
  if (inv?.receiptFileId) await deleteFileFromDrive(inv.receiptFileId).catch(() => {});
}
