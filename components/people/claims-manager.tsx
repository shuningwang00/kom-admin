"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CATEGORIES = [
  "Printing/Stationery",
  "Transport",
  "Cleaning",
  "Others",
] as const;

type Claim = {
  id: string;
  staffEmail: string;
  staffName: string;
  claimDate: string;
  amount: string;
  category: string;
  description: string;
  receiptFileId: string | null;
  receiptFileName: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
};

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

function StatusBadge({ status, reason }: { status: string; reason?: string | null }) {
  const base = "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold";
  if (status === "approved") return <span className={`${base} bg-green-100 text-green-700`}>Approved</span>;
  if (status === "rejected") return (
    <span className={`${base} bg-red-100 text-red-700`} title={reason ?? undefined}>
      Rejected{reason ? " ⓘ" : ""}
    </span>
  );
  return <span className={`${base} bg-yellow-100 text-yellow-700`}>Pending</span>;
}

export default function ClaimsManager() {
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isOwnerView, setIsOwnerView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New claim form
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(today);
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState<string>(CATEGORIES[0]);
  const [formDescription, setFormDescription] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Rejection modal
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/claims?month=${month}`);
    setLoading(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Failed to load");
      return;
    }
    const data = (await res.json()) as { claims: Claim[]; isOwner: boolean };
    setClaims(data.claims);
    setIsOwnerView(data.isOwner);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  async function submitClaim() {
    setFormError("");
    if (!formDate || !formAmount || !formCategory) {
      setFormError("Date, amount, and category are required.");
      return;
    }
    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError("Amount must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("claimDate", formDate);
      fd.append("amount", amt.toFixed(2));
      fd.append("category", formCategory);
      fd.append("description", formDescription);
      if (formFile) fd.append("receipt", formFile);

      const res = await fetch("/api/claims", { method: "POST", body: fd });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setFormError(d.error ?? "Failed to submit");
        return;
      }
      setShowForm(false);
      setFormAmount("");
      setFormDescription("");
      setFormFile(null);
      if (fileRef.current) fileRef.current.value = "";
      if (formDate.slice(0, 7) === month) await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function reviewClaim(id: string, status: "approved" | "rejected") {
    setReviewing(true);
    const res = await fetch(`/api/claims/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, rejectionReason: rejectReason || undefined }),
    });
    setReviewing(false);
    if (res.ok) {
      setRejectingId(null);
      setRejectReason("");
      await load();
    }
  }

  const pendingClaims = claims.filter((c) => c.status === "pending");
  const myClaims = isOwnerView ? [] : claims;

  return (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMonth(prevMonth(month))}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">←</button>
        <span className="min-w-44 text-center text-sm font-semibold text-zinc-800">
          {formatMonthLabel(month)}
        </span>
        <button type="button" onClick={() => setMonth(nextMonth(month))}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">→</button>
        <button type="button" onClick={() => setMonth(today.slice(0, 7))}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50">This month</button>
        <div className="flex-1" />
        <button type="button" onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700">
          + New claim
        </button>
      </div>

      {/* New claim form */}
      {showForm && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-zinc-800">New claim</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Date of purchase</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Amount (S$)</label>
              <input type="number" step="0.01" min="0.01" placeholder="0.00"
                value={formAmount} onChange={(e) => setFormAmount(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Category</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Receipt (optional)</label>
              <input ref={fileRef} type="file" accept="image/*,application/pdf"
                onChange={(e) => setFormFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-zinc-600 file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-zinc-200" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Description</label>
              <input type="text" placeholder="What was purchased?" value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={submitClaim} disabled={submitting}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit claim"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <>
          {/* Owner: pending review section */}
          {isOwnerView && pendingClaims.length > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 shadow-sm">
              <div className="border-b border-orange-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-orange-800">
                  Pending review — {pendingClaims.length} claim{pendingClaims.length !== 1 ? "s" : ""}
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orange-100 text-left text-xs font-medium uppercase tracking-wide text-orange-700">
                    <th className="px-4 py-2">Staff</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2">Receipt</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100">
                  {pendingClaims.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{c.staffName || c.staffEmail}</td>
                      <td className="px-4 py-3 text-zinc-600">{c.claimDate}</td>
                      <td className="px-4 py-3 text-zinc-600">{c.category}</td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">S${parseFloat(c.amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-zinc-600">{c.description || <span className="text-zinc-400">—</span>}</td>
                      <td className="px-4 py-3">
                        {c.receiptFileId ? (
                          <a href={`https://drive.google.com/file/d/${c.receiptFileId}/view`} target="_blank" rel="noreferrer"
                            className="text-sky-600 underline hover:text-sky-800 text-xs">{c.receiptFileName ?? "Receipt"}</a>
                        ) : <span className="text-zinc-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {rejectingId === c.id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <input type="text" placeholder="Reason (optional)"
                              value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                              className="w-36 rounded border border-zinc-300 px-2 py-1 text-xs" />
                            <button type="button" disabled={reviewing}
                              onClick={() => reviewClaim(c.id, "rejected")}
                              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                              {reviewing ? "…" : "Confirm"}
                            </button>
                            <button type="button" onClick={() => setRejectingId(null)}
                              className="text-xs text-zinc-500 hover:text-zinc-800">✕</button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-1.5">
                            <button type="button" onClick={() => reviewClaim(c.id, "approved")}
                              className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700">
                              Approve
                            </button>
                            <button type="button" onClick={() => { setRejectingId(c.id); setRejectReason(""); }}
                              className="rounded bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-200">
                              Reject
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* All claims for the month */}
          <ClaimsTable claims={claims} isOwnerView={isOwnerView} month={month} />
        </>
      )}
    </div>
  );
}

function ClaimsTable({ claims, isOwnerView, month }: { claims: Claim[]; isOwnerView: boolean; month: string }) {
  if (claims.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
        No claims for {new Date(month + "-01").toLocaleDateString("en-SG", { month: "long", year: "numeric" })}.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-800">
          All claims — {new Date(month + "-01").toLocaleDateString("en-SG", { month: "long", year: "numeric" })}
        </h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
            {isOwnerView && <th className="px-4 py-2">Staff</th>}
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2 text-right">Amount</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2">Receipt</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {claims.map((c) => (
            <tr key={c.id}>
              {isOwnerView && <td className="px-4 py-3 font-medium text-zinc-900">{c.staffName || c.staffEmail}</td>}
              <td className="px-4 py-3 text-zinc-600">{c.claimDate}</td>
              <td className="px-4 py-3 text-zinc-600">{c.category}</td>
              <td className="px-4 py-3 text-right font-semibold text-zinc-900">S${parseFloat(c.amount).toFixed(2)}</td>
              <td className="px-4 py-3 text-zinc-600">{c.description || <span className="text-zinc-400">—</span>}</td>
              <td className="px-4 py-3">
                {c.receiptFileId ? (
                  <a href={`https://drive.google.com/file/d/${c.receiptFileId}/view`} target="_blank" rel="noreferrer"
                    className="text-sky-600 underline hover:text-sky-800 text-xs">{c.receiptFileName ?? "Receipt"}</a>
                ) : <span className="text-zinc-400 text-xs">—</span>}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={c.status} reason={c.rejectionReason} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
