"use client";

import { useCallback, useEffect, useState } from "react";

type Override = {
  id: string;
  studentId: string;
  studentName: string;
  classId: string | null;
  classLabel: string | null;
  ratePerLesson: string;
  validFrom: string | null;
  validTo: string | null;
  notes: string;
  createdBy: string;
};

type StudentOption = { id: string; name: string };
type ClassOption = { id: string; label: string };

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const EMPTY_FORM = {
  studentId: "",
  classId: "",
  ratePerLesson: "",
  validFrom: "",
  validTo: "",
  notes: "",
};

export default function BillingRateOverrides() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/billing/rate-overrides");
    setLoading(false);
    if (!res.ok) { setError("Failed to load overrides"); return; }
    const data = (await res.json()) as { overrides: Override[] };
    setOverrides(data.overrides);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    Promise.all([
      fetch("/api/students?withdrawn=0").then((r) => r.json()),
      fetch("/api/classes").then((r) => r.json()),
    ]).then(([sd, cd]) => {
      setStudents((sd as { students: StudentOption[] }).students ?? []);
      setClasses((cd as { classes: ClassOption[] }).classes ?? []);
    }).catch(() => {});
  }, []);

  async function handleAdd() {
    setSaving(true);
    setFormError("");
    const res = await fetch("/api/billing/rate-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: form.studentId,
        classId: form.classId || null,
        ratePerLesson: form.ratePerLesson,
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
        notes: form.notes,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setFormError(d.error ?? "Failed to save");
      return;
    }
    setForm(EMPTY_FORM);
    setShowForm(false);
    await load();
  }

  async function handleEdit() {
    if (!editId) return;
    setEditSaving(true);
    setEditError("");
    const res = await fetch(`/api/billing/rate-overrides/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId: editForm.classId || null,
        ratePerLesson: editForm.ratePerLesson,
        validFrom: editForm.validFrom || null,
        validTo: editForm.validTo || null,
        notes: editForm.notes,
      }),
    });
    setEditSaving(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setEditError(d.error ?? "Failed to save");
      return;
    }
    setEditId(null);
    await load();
  }

  async function handleDelete(id: string, studentName: string) {
    if (!confirm(`Remove rate override for ${studentName}?`)) return;
    await fetch(`/api/billing/rate-overrides/${id}`, { method: "DELETE" });
    await load();
  }

  function startEdit(o: Override) {
    setEditId(o.id);
    setEditForm({
      studentId: o.studentId,
      classId: o.classId ?? "",
      ratePerLesson: o.ratePerLesson,
      validFrom: o.validFrom ?? "",
      validTo: o.validTo ?? "",
      notes: o.notes,
    });
    setEditError("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Rate overrides</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Per-student custom lesson rates. Overrides the standard tier rate when generating invoices.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setFormError(""); }}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          {showForm ? "Cancel" : "+ Add override"}
        </button>
      </div>

      {/* Standard rates reference */}
      <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
        <span className="font-medium text-zinc-700">Standard rates: </span>
        Lower Sec S$70 · Upper Sec S$85 · Upper Sec A+E bundle S$77.50 · JC S$100
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-medium text-zinc-700">New rate override</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Student *</span>
              <select
                value={form.studentId}
                onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
              >
                <option value="">— select student —</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Class (optional — leave blank to apply to all classes)</span>
              <select
                value={form.classId}
                onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
              >
                <option value="">All classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Rate per lesson (S$) *</span>
              <input
                type="number" min="0" step="0.50" value={form.ratePerLesson}
                onChange={(e) => setForm((f) => ({ ...f, ratePerLesson: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
                placeholder="e.g. 90"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Valid from (optional)</span>
              <input
                type="date" value={form.validFrom}
                onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Valid to (optional)</span>
              <input
                type="date" value={form.validTo}
                onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Notes</span>
              <input
                type="text" value={form.notes} placeholder="e.g. Sibling discount"
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
              />
            </label>
          </div>
          {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={() => { setShowForm(false); setFormError(""); }} className="text-sm text-zinc-500 hover:text-zinc-800">Cancel</button>
            <button
              type="button" onClick={() => void handleAdd()}
              disabled={saving || !form.studentId || !form.ratePerLesson}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >{saving ? "Saving…" : "Save override"}</button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : overrides.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
          No rate overrides yet. Standard tier rates apply to all students.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
                <th className="px-4 py-2">Student</th>
                <th className="px-4 py-2">Class</th>
                <th className="px-4 py-2 text-right">Rate / lesson</th>
                <th className="px-4 py-2">Valid from</th>
                <th className="px-4 py-2">Valid to</th>
                <th className="px-4 py-2">Notes</th>
                <th className="px-4 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {overrides.map((o) => (
                editId === o.id ? (
                  <tr key={o.id} className="bg-amber-50/40">
                    <td className="px-4 py-2 font-medium text-zinc-900">{o.studentName}</td>
                    <td className="px-4 py-2">
                      <select
                        value={editForm.classId}
                        onChange={(e) => setEditForm((f) => ({ ...f, classId: e.target.value }))}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs"
                      >
                        <option value="">All classes</option>
                        {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number" min="0" step="0.50" value={editForm.ratePerLesson}
                        onChange={(e) => setEditForm((f) => ({ ...f, ratePerLesson: e.target.value }))}
                        className="w-20 rounded border border-zinc-300 px-2 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input type="date" value={editForm.validFrom}
                        onChange={(e) => setEditForm((f) => ({ ...f, validFrom: e.target.value }))}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input type="date" value={editForm.validTo}
                        onChange={(e) => setEditForm((f) => ({ ...f, validTo: e.target.value }))}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input type="text" value={editForm.notes}
                        onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {editError && <p className="text-xs text-red-600">{editError}</p>}
                        <div className="flex gap-2">
                          <button type="button" onClick={() => void handleEdit()} disabled={editSaving}
                            className="text-xs font-medium text-orange-600 hover:text-orange-800 disabled:opacity-50"
                          >{editSaving ? "…" : "Save"}</button>
                          <button type="button" onClick={() => setEditId(null)}
                            className="text-xs text-zinc-400 hover:text-zinc-600"
                          >Cancel</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={o.id} className="hover:bg-zinc-50/40">
                    <td className="px-4 py-3 font-medium text-zinc-900">{o.studentName}</td>
                    <td className="px-4 py-3 text-zinc-600">{o.classLabel ?? <span className="text-zinc-400">All classes</span>}</td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">S${parseFloat(o.ratePerLesson).toFixed(2)}</td>
                    <td className="px-4 py-3 text-zinc-500">{fmtDate(o.validFrom)}</td>
                    <td className="px-4 py-3 text-zinc-500">{fmtDate(o.validTo)}</td>
                    <td className="px-4 py-3 text-zinc-500">{o.notes || <span className="text-zinc-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button type="button" onClick={() => startEdit(o)}
                          className="text-xs text-zinc-400 hover:text-zinc-700"
                        >Edit</button>
                        <button type="button" onClick={() => void handleDelete(o.id, o.studentName)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
