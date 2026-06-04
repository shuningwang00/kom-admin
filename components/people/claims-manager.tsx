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
  const [userEmail, setUserEmail] = useState("");
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

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState<string>(CATEGORIES[0]);
  const [editDescription, setEditDescription] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const editFileRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
    const data = (await res.json()) as { claims: Claim[]; isOwner: boolean; userEmail: string };
    setClaims(data.claims);
    setIsOwnerView(data.isOwner);
    setUserEmail(data.userEmail);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  async function submitClaim() {
    setFormError("");
    if (!formDate || !formAmount || !formCategory || !formFile) {
      setFormError("Date, amount, category, and a receipt are required.");
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

  function startEdit(c: Claim) {
    setEditingId(c.id);
    setEditDate(c.claimDate);
    setEditAmount(parseFloat(c.amount).toFixed(2));
    setEditCategory(c.category);
    setEditDescription(c.description);
    setEditFile(null);
    setEditError("");
    if (editFileRef.current) editFileRef.current.value = "";
  }

  async function saveEdit(id: string) {
    setEditError("");
    const amt = parseFloat(editAmount);
    if (!editDate || isNaN(amt) || amt <= 0) {
      setEditError("Date and a valid amount are required.");
      return;
    }
    setEditSaving(true);
    const fd = new FormData();
    fd.append("claimDate", editDate);
    fd.append("amount", amt.toFixed(2));
    fd.append("category", editCategory);
    fd.append("description", editDescription);
    if (editFile) fd.append("receipt", editFile);

    const res = await fetch(`/api/claims/${id}`, { method: "PATCH", body: fd });
    setEditSaving(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setEditError(d.error ?? "Failed to save");
      return;
    }
    setEditingId(null);
    await load();
  }

  async function confirmDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/claims/${id}`, { method: "DELETE" });
    setDeletingId(null);
    setDeleteConfirmId(null);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Failed to delete");
      return;
    }
    await load();
  }

  const pendingClaims = claims.filter((c) => c.status === "pending");

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
              <label className="mb-1 block text-xs font-medium text-zinc-600">Receipt *</label>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" required
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
              <div className="overflow-x-auto">
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
                            {deleteConfirmId === c.id ? (
                              <>
                                <button type="button" disabled={deletingId === c.id}
                                  onClick={() => confirmDelete(c.id)}
                                  className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                                  {deletingId === c.id ? "…" : "Sure?"}
                                </button>
                                <button type="button" onClick={() => setDeleteConfirmId(null)}
                                  className="text-xs text-zinc-500 hover:text-zinc-800">✕</button>
                              </>
                            ) : (
                              <button type="button" onClick={() => setDeleteConfirmId(c.id)}
                                className="rounded border border-zinc-300 px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-100">
                                Delete
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* All claims for the month */}
          <ClaimsTable
            claims={claims}
            isOwnerView={isOwnerView}
            userEmail={userEmail}
            month={month}
            editingId={editingId}
            editDate={editDate}
            editAmount={editAmount}
            editCategory={editCategory}
            editDescription={editDescription}
            editError={editError}
            editSaving={editSaving}
            editFileRef={editFileRef}
            deleteConfirmId={deleteConfirmId}
            deletingId={deletingId}
            onStartEdit={startEdit}
            onEditDate={setEditDate}
            onEditAmount={setEditAmount}
            onEditCategory={setEditCategory}
            onEditDescription={setEditDescription}
            onEditFile={setEditFile}
            onSaveEdit={saveEdit}
            onCancelEdit={() => setEditingId(null)}
            onDeleteConfirm={setDeleteConfirmId}
            onConfirmDelete={confirmDelete}
            onCancelDelete={() => setDeleteConfirmId(null)}
          />
        </>
      )}
    </div>
  );
}

function ClaimsTable({
  claims, isOwnerView, userEmail, month,
  editingId, editDate, editAmount, editCategory, editDescription,
  editError, editSaving, editFileRef, deleteConfirmId, deletingId,
  onStartEdit, onEditDate, onEditAmount, onEditCategory, onEditDescription,
  onEditFile, onSaveEdit, onCancelEdit, onDeleteConfirm, onConfirmDelete, onCancelDelete,
}: {
  claims: Claim[];
  isOwnerView: boolean;
  userEmail: string;
  month: string;
  editingId: string | null;
  editDate: string;
  editAmount: string;
  editCategory: string;
  editDescription: string;
  editError: string;
  editSaving: boolean;
  editFileRef: React.RefObject<HTMLInputElement | null>;
  deleteConfirmId: string | null;
  deletingId: string | null;
  onStartEdit: (c: Claim) => void;
  onEditDate: (v: string) => void;
  onEditAmount: (v: string) => void;
  onEditCategory: (v: string) => void;
  onEditDescription: (v: string) => void;
  onEditFile: (f: File | null) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDeleteConfirm: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}) {
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
      <div className="overflow-x-auto">
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
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {claims.map((c) => {
            const canEdit = c.status === "pending" && (isOwnerView || c.staffEmail === userEmail);
            const canDelete = isOwnerView || (c.staffEmail === userEmail && c.status === "pending");

            if (editingId === c.id) {
              return (
                <tr key={c.id} className="bg-orange-50/40">
                  <td colSpan={isOwnerView ? 8 : 7} className="px-4 py-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">Date</label>
                        <input type="date" value={editDate} onChange={(e) => onEditDate(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">Amount (S$)</label>
                        <input type="number" step="0.01" min="0.01" value={editAmount}
                          onChange={(e) => onEditAmount(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">Category</label>
                        <select value={editCategory} onChange={(e) => onEditCategory(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm">
                          {CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Receipt {c.receiptFileName ? `(current: ${c.receiptFileName})` : "(optional)"}
                        </label>
                        <input ref={editFileRef} type="file" accept="image/*,application/pdf"
                          onChange={(e) => onEditFile(e.target.files?.[0] ?? null)}
                          className="w-full text-sm text-zinc-600 file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-zinc-200" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-zinc-600">Description</label>
                        <input type="text" value={editDescription}
                          onChange={(e) => onEditDescription(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm" />
                      </div>
                    </div>
                    {editError && <p className="mt-1 text-xs text-red-600">{editError}</p>}
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={editSaving} onClick={() => onSaveEdit(c.id)}
                        className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50">
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                      <button type="button" onClick={onCancelEdit}
                        className="text-xs text-zinc-500 hover:text-zinc-800">Cancel</button>
                    </div>
                  </td>
                </tr>
              );
            }

            return (
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
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex gap-2">
                    {canEdit && (
                      <button type="button" onClick={() => onStartEdit(c)}
                        className="text-xs font-medium text-orange-700 hover:underline">
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      deleteConfirmId === c.id ? (
                        <>
                          <button type="button" disabled={deletingId === c.id}
                            onClick={() => onConfirmDelete(c.id)}
                            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">
                            {deletingId === c.id ? "…" : "Sure?"}
                          </button>
                          <button type="button" onClick={onCancelDelete}
                            className="text-xs text-zinc-400 hover:text-zinc-600">✕</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => onDeleteConfirm(c.id)}
                          className="text-xs text-zinc-400 hover:text-red-600">
                          Delete
                        </button>
                      )
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
