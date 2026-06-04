"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardStudentRow } from "@/lib/billing/invoice-db";
import type { InvoicePreview } from "@/lib/billing/compute-invoice";

// ─── helpers ──────────────────────────────────────────────────────────────────

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

function fmtMoney(s: string | number | null | undefined): string {
  if (s == null) return "—";
  const n = typeof s === "number" ? s : parseFloat(s);
  return `S$${n.toFixed(2)}`;
}

function levelSortKey(level: string): string {
  if (level === "Siblings") return "0";
  if (level === "JC") return "1";
  if (level === "Upper Sec") return "2";
  if (level === "Lower Sec") return "3";
  return "4";
}

// ─── status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  if (!status || status === "draft") return null;
  const map: Record<string, string> = {
    sent: "bg-amber-100 text-amber-700",
    partial: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
    void: "bg-zinc-100 text-zinc-500",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${map[status] ?? "bg-zinc-100 text-zinc-500"}`}>
      {status}
    </span>
  );
}

// ─── invoice preview modal ─────────────────────────────────────────────────────

type PreviewState = {
  studentIds: string[];
  studentNames: string[];
  preview: InvoicePreview;
  discount: string;
  remarks: string;
};

function PreviewModal({
  state, onDiscount, onRemarks, onConfirm, onClose, saving, error,
}: {
  state: PreviewState;
  onDiscount: (v: string) => void;
  onRemarks: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  saving: boolean;
  error: string;
}) {
  const { preview } = state;
  const discount = parseFloat(state.discount) || 0;
  const finalDue = Math.max(0, preview.totalDue - discount);
  const hasBillable = preview.lineItems.some((l) => l.type === "tuition" || l.type === "registration_fee");
  const multiStudent = state.studentNames.length > 1;

  // Group line items by student for display when multiple students
  const studentSections = multiStudent
    ? state.studentNames.map((name, i) => ({
        name,
        studentId: state.studentIds[i],
        items: preview.lineItems.filter((l) => l.studentId === state.studentIds[i] && (l.type === "tuition" || l.type === "registration_fee")),
      }))
    : null;

  const metaItems = multiStudent
    ? preview.lineItems.filter((l) => l.type === "balance_forward" || l.type === "credit")
    : preview.lineItems;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="border-b border-zinc-200 px-5 py-4">
          <p className="font-semibold text-zinc-900">Invoice preview — {state.studentNames.join(", ")}</p>
          <p className="text-xs text-zinc-500">{preview.billingMonth}</p>
        </div>
        <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
          {!hasBillable ? (
            <p className="text-sm text-zinc-500">No billable sessions found for {preview.billingMonth}.</p>
          ) : multiStudent ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-zinc-500">
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {studentSections!.map((sec) => (
                  <>
                    <tr key={`hdr-${sec.studentId}`} className="bg-zinc-50">
                      <td colSpan={2} className="py-1.5 text-xs font-semibold text-zinc-500">{sec.name}</td>
                    </tr>
                    {sec.items.map((item, i) => (
                      <tr key={i} className="text-zinc-700">
                        <td className="py-1.5">
                          <span className="font-medium">{item.description}</span>
                          {item.detail && <span className="ml-1 text-xs text-zinc-400">· {item.detail}</span>}
                        </td>
                        <td className="py-1.5 text-right">{fmtMoney(item.amount)}</td>
                      </tr>
                    ))}
                  </>
                ))}
                {metaItems.filter((l) => l.type === "balance_forward" || l.type === "credit").map((item, i) => (
                  <tr key={`meta-${i}`} className="text-zinc-700">
                    <td className="py-1.5">
                      <span className="font-medium">{item.description}</span>
                    </td>
                    <td className={`py-1.5 text-right ${item.amount < 0 ? "text-green-600" : ""}`}>
                      {fmtMoney(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-zinc-200 font-medium">
                {discount > 0 && (
                  <tr className="text-green-600 text-sm">
                    <td className="pt-2">Discount</td>
                    <td className="pt-2 text-right">−{fmtMoney(discount)}</td>
                  </tr>
                )}
                <tr className="text-zinc-900">
                  <td className="pt-2">Total due</td>
                  <td className="pt-2 text-right text-orange-600 font-semibold">{fmtMoney(finalDue)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-zinc-500">
                  <th className="pb-2">Description</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {preview.lineItems.map((item, i) => (
                  <tr key={i} className="text-zinc-700">
                    <td className="py-1.5">
                      <span className="font-medium">{item.description}</span>
                      {item.detail && <span className="ml-1 text-xs text-zinc-400">· {item.detail}</span>}
                    </td>
                    <td className={`py-1.5 text-right ${item.amount < 0 ? "text-green-600" : ""}`}>
                      {fmtMoney(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-zinc-200 font-medium">
                {discount > 0 && (
                  <tr className="text-green-600 text-sm">
                    <td className="pt-2">Discount</td>
                    <td className="pt-2 text-right">−{fmtMoney(discount)}</td>
                  </tr>
                )}
                <tr className="text-zinc-900">
                  <td className="pt-2">Total due</td>
                  <td className="pt-2 text-right text-orange-600 font-semibold">{fmtMoney(finalDue)}</td>
                </tr>
              </tfoot>
            </table>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Discount (S$)</span>
              <input
                type="number" min="0" step="0.01" value={state.discount}
                onChange={(e) => onDiscount(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Remarks (printed on invoice)</span>
              <input
                type="text" value={state.remarks}
                onChange={(e) => onRemarks(e.target.value)}
                placeholder="e.g. Trial lesson included"
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
              />
            </label>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4">
          <button type="button" onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-800">Cancel</button>
          <button
            type="button" onClick={onConfirm}
            disabled={saving || !hasBillable}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? "Generating…" : "Generate invoice + PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── payment modal ─────────────────────────────────────────────────────────────

type PaymentState = {
  invoiceId: string;
  invoiceNumber: string;
  totalDue: string;
  totalPaid: string;
};

function PaymentModal({
  state, onClose, onConfirm, saving, error,
}: {
  state: PaymentState;
  onClose: () => void;
  onConfirm: (amount: number, date: string, notes: string) => void;
  saving: boolean;
  error: string;
}) {
  const outstanding = Math.max(0, parseFloat(state.totalDue) - parseFloat(state.totalPaid));
  const [amount, setAmount] = useState(outstanding.toFixed(2));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="border-b border-zinc-200 px-5 py-4">
          <p className="font-semibold text-zinc-900">Record payment</p>
          <p className="text-xs text-zinc-500">{state.invoiceNumber} · Outstanding: {fmtMoney(outstanding)}</p>
        </div>
        <div className="space-y-3 px-5 py-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Amount (S$) *</span>
            <input
              type="number" min="0.01" step="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Payment date *</span>
            <input
              type="date" value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Notes</span>
            <input
              type="text" value={notes} placeholder="e.g. PayNow"
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4">
          <button type="button" onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-800">Cancel</button>
          <button
            type="button" onClick={() => onConfirm(parseFloat(amount), date, notes)}
            disabled={saving || !amount || !date}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Record payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── main dashboard ───────────────────────────────────────────────────────────

export default function BillingDashboard() {
  const [month, setMonth] = useState(currentMonth);
  const [rows, setRows] = useState<DashboardStudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [previewModal, setPreviewModal] = useState<PreviewState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewSaving, setPreviewSaving] = useState(false);

  const [paymentModal, setPaymentModal] = useState<PaymentState | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const [busySet, setBusySet] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/billing?month=${month}`);
    setLoading(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Failed to load");
      return;
    }
    const data = (await res.json()) as { rows: DashboardStudentRow[] };
    setRows(data.rows);
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  // Group rows by level; billing-group families go into their own "Siblings" section
  const grouped = rows.reduce<Map<string, DashboardStudentRow[]>>((acc, row) => {
    const key = row.billingGroupId ? "Siblings" : (row.level || "Other");
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(row);
    return acc;
  }, new Map());
  const sortedLevels = [...grouped.keys()].sort((a, b) => levelSortKey(a).localeCompare(levelSortKey(b)));

  async function openPreview(row: DashboardStudentRow) {
    setPreviewLoading(true);
    setPreviewError("");
    const res = await fetch(`/api/billing/preview?studentIds=${row.studentIds.join(",")}&month=${month}`);
    setPreviewLoading(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setPreviewError(d.error ?? "Failed to load preview");
      return;
    }
    const data = (await res.json()) as { preview: InvoicePreview };
    if (data.preview.existingInvoiceId) {
      setPreviewError("Invoice already exists for this student and month.");
      await load();
      return;
    }
    setPreviewModal({
      studentIds: row.studentIds,
      studentNames: row.studentNames,
      preview: data.preview,
      discount: "0",
      remarks: "",
    });
  }

  async function confirmInvoice() {
    if (!previewModal) return;
    setPreviewSaving(true);
    setPreviewError("");
    const discount = parseFloat(previewModal.discount) || 0;

    const res = await fetch("/api/billing/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentIds: previewModal.studentIds,
        billingMonth: month,
        discountAmount: discount,
        remarks: previewModal.remarks,
      }),
    });

    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setPreviewError(d.error ?? "Failed to create invoice");
      setPreviewSaving(false);
      return;
    }

    const data = (await res.json()) as { invoice: { id: string } };
    setPreviewModal(null);
    setPreviewSaving(false);
    await load();
    void triggerPdf(data.invoice.id);
  }

  async function triggerPdf(invoiceId: string) {
    setBusySet((s) => new Set(s).add(invoiceId));
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}/pdf`, { method: "POST" });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Failed to generate PDF");
      }
      await load();
    } finally {
      setBusySet((s) => { const n = new Set(s); n.delete(invoiceId); return n; });
    }
  }

  async function triggerReceipt(invoiceId: string) {
    setBusySet((s) => new Set(s).add(invoiceId + ":rcp"));
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}/receipt`, { method: "POST" });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Failed to generate receipt");
      }
      await load();
    } finally {
      setBusySet((s) => { const n = new Set(s); n.delete(invoiceId + ":rcp"); return n; });
    }
  }

  async function submitPayment(amount: number, date: string, notes: string) {
    if (!paymentModal) return;
    setPaymentSaving(true);
    setPaymentError("");
    const res = await fetch(`/api/billing/invoices/${paymentModal.invoiceId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, paymentDate: date, notes }),
    });
    setPaymentSaving(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setPaymentError(d.error ?? "Failed to record payment");
      return;
    }
    setPaymentModal(null);
    await load();
  }

  async function handleMarkSent(invoiceId: string) {
    const res = await fetch(`/api/billing/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markSent: true }),
    });
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Failed to mark as sent");
      return;
    }
    await load();
  }

  async function handleVoid(invoiceId: string, invoiceNumber: string) {
    if (!confirm(`Void invoice ${invoiceNumber}? This will delete the PDF from Drive and cannot be undone.`)) return;
    const res = await fetch(`/api/billing/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ void: true }),
    });
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Failed to void invoice");
      return;
    }
    await load();
  }

  const invoicedRows = rows.filter((r) => r.invoiceId);
  const totalBilled = invoicedRows.reduce((s, r) => s + parseFloat(r.totalDue ?? "0"), 0);
  const totalCollected = invoicedRows.reduce((s, r) => s + parseFloat(r.totalPaid ?? "0"), 0);

  return (
    <div className="space-y-6">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href="/billing/rates" className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2">Rate overrides</a>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth(prevMonth(month))}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >←</button>
          <span className="min-w-36 text-center text-sm font-semibold text-zinc-800">
            {formatMonthLabel(month)}
          </span>
          <button
            type="button"
            onClick={() => setMonth(nextMonth(month))}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >→</button>
          <button
            type="button"
            onClick={() => setMonth(currentMonth())}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50"
          >Today</button>
        </div>
        {invoicedRows.length > 0 && (
          <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
            <span>{invoicedRows.length} / {rows.length} invoiced</span>
            <span>Total billed: <strong className="text-zinc-900">{fmtMoney(totalBilled)}</strong></span>
            <span>Collected: <strong className="text-green-700">{fmtMoney(totalCollected)}</strong></span>
          </div>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {previewError && !previewModal && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{previewError}</div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-400">Loading…</div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500 shadow-sm">
          No active students with enrollments for {month}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                <th className="px-4 py-2 w-44">Student</th>
                <th className="px-4 py-2">Classes</th>
                <th className="px-4 py-2 w-32 text-right">Total due</th>
                <th className="px-4 py-2 w-36">Invoice</th>
                <th className="px-4 py-2 w-20">Status</th>
                <th className="px-4 py-2 w-32">Payment</th>
                <th className="px-4 py-2 w-24">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sortedLevels.map((level) => (
                <>
                  <tr key={`grp-${level}`} className="bg-zinc-50/60">
                    <td colSpan={8} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      {level}
                    </td>
                  </tr>
                  {grouped.get(level)!.map((row) => {
                    const rowKey = row.studentIds.join(",");
                    const isVoid = row.invoiceStatus === "void";
                    const isDraft = row.invoiceStatus === "draft";
                    const isPaidOrPartial = row.invoiceStatus === "paid" || row.invoiceStatus === "partial";
                    const pdfBusy = busySet.has(row.invoiceId ?? "");
                    const rcpBusy = busySet.has((row.invoiceId ?? "") + ":rcp");

                    const waLink = row.pdfFileId
                      ? `https://wa.me/?text=${encodeURIComponent(`Hi ${row.contactName}, please find your invoice ${row.invoiceNumber} here: https://drive.google.com/file/d/${row.pdfFileId}/view`)}`
                      : null;

                    // Group classes by student for multi-student display
                    const classDisplay = row.studentNames.length > 1
                      ? row.studentNames.map((name, i) => {
                          const sid = row.studentIds[i];
                          const cls = row.enrolledClasses.filter((c) => c.studentId === sid).map((c) => c.classLabel).join(", ");
                          return cls ? `${name}: ${cls}` : null;
                        }).filter(Boolean).join(" · ")
                      : row.enrolledClasses.map((c) => c.classLabel).join(", ");

                    return (
                      <tr key={rowKey} className="hover:bg-zinc-50/40">
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {row.studentNames.join(", ")}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{classDisplay}</td>
                        <td className="px-4 py-3 text-right font-medium text-zinc-900">
                          {row.totalDue != null
                            ? fmtMoney(row.totalDue)
                            : row.estimatedTotal != null
                            ? <span className="text-zinc-400">~{fmtMoney(row.estimatedTotal)}</span>
                            : "—"}
                        </td>

                        <td className="px-4 py-3">
                          {(!row.invoiceId || isVoid) ? (
                            <button
                              type="button"
                              disabled={previewLoading}
                              onClick={() => void openPreview(row)}
                              className="rounded bg-orange-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                            >INV</button>
                          ) : (
                            <span className="inline-flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1.5">
                                {row.pdfFileId ? (
                                  <a
                                    href={`https://drive.google.com/file/d/${row.pdfFileId}/view`}
                                    target="_blank" rel="noreferrer"
                                    className="rounded bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
                                  >PDF</a>
                                ) : !isVoid && (
                                  <button
                                    type="button" disabled={pdfBusy}
                                    onClick={() => void triggerPdf(row.invoiceId!)}
                                    className="rounded bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
                                  >{pdfBusy ? "…" : "PDF"}</button>
                                )}
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank" rel="noreferrer"
                                    className="inline-flex items-center justify-center rounded p-1 text-[#25D366] hover:bg-green-50"
                                    title="Send via WhatsApp"
                                  >
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                  </a>
                                )}
                                <span className="text-xs text-zinc-400">{row.invoiceNumber}</span>
                              </span>
                              {!isVoid && (
                                <button
                                  type="button"
                                  onClick={() => void handleVoid(row.invoiceId!, row.invoiceNumber!)}
                                  className="self-start rounded px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700"
                                >VOID</button>
                              )}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3"><StatusBadge status={row.invoiceStatus} /></td>

                        <td className="px-4 py-3">
                          {isDraft && row.invoiceId ? (
                            <button
                              type="button"
                              onClick={() => void handleMarkSent(row.invoiceId!)}
                              className="rounded bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-600"
                            >SENT?</button>
                          ) : row.invoiceId && row.invoiceStatus === "paid" ? (
                            <span className="text-sm font-medium text-zinc-700">{fmtMoney(row.totalPaid)}</span>
                          ) : row.invoiceId && !isVoid ? (
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => setPaymentModal({
                                  invoiceId: row.invoiceId!,
                                  invoiceNumber: row.invoiceNumber!,
                                  totalDue: row.totalDue!,
                                  totalPaid: row.totalPaid ?? "0",
                                })}
                                className="self-start rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
                              >PAID</button>
                              {parseFloat(row.totalPaid ?? "0") > 0 && (
                                <span className="text-xs text-zinc-500">{fmtMoney(row.totalPaid)} paid</span>
                              )}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3">
                          {isPaidOrPartial && (
                            row.receiptFileId ? (
                              <a
                                href={`https://drive.google.com/file/d/${row.receiptFileId}/view`}
                                target="_blank" rel="noreferrer"
                                className="rounded bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
                              >RCP</a>
                            ) : (
                              <button
                                type="button" disabled={rcpBusy}
                                onClick={() => void triggerReceipt(row.invoiceId!)}
                                className="rounded bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
                              >{rcpBusy ? "…" : "RCP"}</button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewModal && (
        <PreviewModal
          state={previewModal}
          onDiscount={(v) => setPreviewModal((m) => m ? { ...m, discount: v } : m)}
          onRemarks={(v) => setPreviewModal((m) => m ? { ...m, remarks: v } : m)}
          onConfirm={() => void confirmInvoice()}
          onClose={() => { setPreviewModal(null); setPreviewError(""); }}
          saving={previewSaving}
          error={previewError}
        />
      )}

      {paymentModal && (
        <PaymentModal
          state={paymentModal}
          onClose={() => { setPaymentModal(null); setPaymentError(""); }}
          onConfirm={(amount, date, notes) => void submitPayment(amount, date, notes)}
          saving={paymentSaving}
          error={paymentError}
        />
      )}
    </div>
  );
}
