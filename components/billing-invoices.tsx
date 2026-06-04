"use client";

import { useCallback, useEffect, useState } from "react";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  billingMonth: string;
  status: string;
  studentNames: string[];
  subtotal: string;
  discountAmount: string;
  totalDue: string;
  totalPaid: string;
  pdfFileId: string | null;
  receiptFileId: string | null;
  sentAt: string | null;
  paidAt: string | null;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "draft") return null;
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

function fmtMoney(s: string) {
  return `S$${parseFloat(s).toFixed(2)}`;
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-SG", { month: "short", year: "numeric" });
}

const STATUS_FILTERS = ["all", "draft", "sent", "partial", "paid", "void"] as const;

export default function BillingInvoices() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/billing/invoices");
    setLoading(false);
    if (!res.ok) { setError("Failed to load invoices"); return; }
    const data = (await res.json()) as { invoices: InvoiceRow[] };
    setInvoices(data.invoices);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = invoices.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.studentNames.some((n) => n.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalDue = filtered.filter(i => i.status !== "void").reduce((s, i) => s + parseFloat(i.totalDue), 0);
  const totalPaid = filtered.filter(i => i.status !== "void").reduce((s, i) => s + parseFloat(i.totalPaid), 0);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student or invoice no."
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm w-56"
        />
        <div className="flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-orange-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="flex gap-4 text-sm text-zinc-500">
          <span>{filtered.length} invoice{filtered.length !== 1 ? "s" : ""}</span>
          <span>Total billed: <strong className="text-zinc-900">{fmtMoney(totalDue.toFixed(2))}</strong></span>
          <span>Collected: <strong className="text-green-700">{fmtMoney(totalPaid.toFixed(2))}</strong></span>
          {totalDue - totalPaid > 0.005 && (
            <span>Outstanding: <strong className="text-amber-700">{fmtMoney((totalDue - totalPaid).toFixed(2))}</strong></span>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="py-12 text-center text-sm text-zinc-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500 shadow-sm">
          No invoices found.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Month</th>
                <th className="px-4 py-2">Student(s)</th>
                <th className="px-4 py-2 w-20">Status</th>
                <th className="px-4 py-2 text-right w-28">Total due</th>
                <th className="px-4 py-2 text-right w-28">Paid</th>
                <th className="px-4 py-2 w-24">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-50/40">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-700">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-zinc-600">{fmtMonth(inv.billingMonth)}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900">{inv.studentNames.join(", ")}</td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3 text-right text-zinc-900">
                    {inv.status === "void" ? <span className="text-zinc-400">—</span> : fmtMoney(inv.totalDue)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600">
                    {parseFloat(inv.totalPaid) > 0 ? (
                      <span className={inv.status === "paid" ? "font-medium text-green-700" : ""}>
                        {fmtMoney(inv.totalPaid)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {inv.pdfFileId && (
                        <a
                          href={`https://drive.google.com/file/d/${inv.pdfFileId}/view`}
                          target="_blank" rel="noreferrer"
                          className="text-xs text-zinc-400 underline hover:text-zinc-700"
                        >PDF</a>
                      )}
                      {inv.receiptFileId && (
                        <a
                          href={`https://drive.google.com/file/d/${inv.receiptFileId}/view`}
                          target="_blank" rel="noreferrer"
                          className="text-xs text-zinc-400 underline hover:text-zinc-700"
                        >RCP</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
