"use client";

import { useCallback, useEffect, useState } from "react";

type ClockEntry = {
  id: string;
  staffEmail: string;
  staffName: string;
  entryDate: string;
  startTime: string;
  endTime: string;
  notes: string;
};

type StaffMember = {
  email: string;
  displayName: string;
  fullName: string;
  hourlyRate: string;
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

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
}

function to12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, "0")}${period}`;
}

function computeHours(start: string, end: string): number {
  const parse = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  return Math.max(0, (parse(end) - parse(start)) / 60);
}

function formatHours(h: number): string {
  if (h === Math.floor(h)) return `${h}h`;
  const mins = Math.round((h % 1) * 60);
  return `${Math.floor(h)}h ${mins}m`;
}

const emptyForm = { entryDate: "", startTime: "", endTime: "", notes: "" };

export default function ClockManager() {
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [isOwnerView, setIsOwnerView] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string>("");
  const [entries, setEntries] = useState<ClockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [todayShift, setTodayShift] = useState<{ startTime: string; endTime: string } | null>(null);
  const [serverToday, setServerToday] = useState(today);
  const [shiftSearchEmail, setShiftSearchEmail] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, entryDate: today });
  const [formStaff, setFormStaff] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const url = `/api/clock?month=${month}`;
    const res = await fetch(url);
    setLoading(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Failed to load");
      return;
    }
    const data = (await res.json()) as {
      entries: ClockEntry[];
      staff: StaffMember[];
      isOwner: boolean;
      todayShift?: { startTime: string; endTime: string } | null;
      today?: string;
      shiftSearchEmail?: string;
    };
    setEntries(data.entries);
    setIsOwnerView(data.isOwner);
    setTodayShift(data.todayShift ?? null);
    if (data.today) setServerToday(data.today);
    if (data.shiftSearchEmail) setShiftSearchEmail(data.shiftSearchEmail);
    if (data.isOwner && data.staff.length > 0) {
      setStaffList(data.staff);
      if (!formStaff) {
        // Default to the logged-in user's own entry if present, else first staff
        const selfEntry = data.shiftSearchEmail
          ? data.staff.find((s) => s.email === data.shiftSearchEmail)
          : undefined;
        setFormStaff((selfEntry ?? data.staff[0]).email);
      }
    }
  }, [month, formStaff]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleEntries = isOwnerView && selectedEmail
    ? entries.filter((e) => e.staffEmail === selectedEmail)
    : entries;

  // Group by date
  const byDate = visibleEntries.reduce<Record<string, ClockEntry[]>>((acc, e) => {
    if (!acc[e.entryDate]) acc[e.entryDate] = [];
    acc[e.entryDate].push(e);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort();

  const totalHours = visibleEntries.reduce(
    (sum, e) => sum + computeHours(e.startTime, e.endTime),
    0,
  );

  async function onAddEntry(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const staffEmail = isOwnerView ? formStaff : undefined;
    const staffMember = staffList.find((s) => s.email === formStaff);
    const res = await fetch("/api/clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffEmail,
        staffName: staffMember?.displayName ?? staffMember?.fullName ?? "",
        ...form,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Failed to save");
      return;
    }
    setForm({ ...emptyForm, entryDate: today });
    setShowForm(false);
    setSuccess("Entry added.");
    await load();
  }

  function startEdit(entry: ClockEntry) {
    setEditingId(entry.id);
    setEditForm({
      entryDate: entry.entryDate,
      startTime: entry.startTime,
      endTime: entry.endTime,
      notes: entry.notes,
    });
    setSuccess("");
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/clock/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSaving(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Failed to save");
      return;
    }
    setEditingId(null);
    setSuccess("Entry updated.");
    await load();
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    const res = await fetch(`/api/clock/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Failed to delete");
      return;
    }
    setSuccess("Entry deleted.");
    await load();
  }

  return (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMonth(prevMonth(month))}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >←</button>
        <span className="min-w-44 text-center text-sm font-semibold text-zinc-800">
          {formatMonthLabel(month)}
        </span>
        <button
          type="button"
          onClick={() => setMonth(nextMonth(month))}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >→</button>
        <button
          type="button"
          onClick={() => setMonth(today.slice(0, 7))}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50"
        >This month</button>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => { setShowForm((v) => !v); setError(""); setSuccess(""); }}
            className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800"
          >
            + Add entry
          </button>
        </div>
      </div>

      {/* Owner: staff filter */}
      {isOwnerView && staffList.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-600">Staff</label>
          <select
            value={selectedEmail}
            onChange={(e) => setSelectedEmail(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700"
          >
            <option value="">All</option>
            {staffList.map((s) => (
              <option key={s.email} value={s.email}>
                {s.displayName || s.fullName || s.email}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Debug: shown only when no shift found — helps confirm email/date mismatch */}
      {!todayShift && !loading && month === serverToday.slice(0, 7) && shiftSearchEmail && (
        <p className="text-xs text-zinc-400">
          No rostered shift found for {shiftSearchEmail} on {serverToday}
        </p>
      )}

      {/* Today's rostered shift suggestion */}
      {todayShift && month === serverToday.slice(0, 7) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-sky-900">Today's rostered shift</p>
            <p className="text-sm text-sky-700">
              {to12h(todayShift.startTime)} – {to12h(todayShift.endTime)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setForm({
                entryDate: serverToday,
                startTime: todayShift.startTime,
                endTime: todayShift.endTime,
                notes: "",
              });
              if (shiftSearchEmail) setFormStaff(shiftSearchEmail);
              setShowForm(true);
            }}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          >
            Log these hours
          </button>
        </div>
      )}

      {/* Add entry form */}
      {showForm && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-800">Add clock entry</h2>
          <form onSubmit={onAddEntry} className="space-y-3">
            {isOwnerView && staffList.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-zinc-600">Staff member</label>
                <select
                  value={formStaff}
                  onChange={(e) => setFormStaff(e.target.value)}
                  className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  {staffList.map((s) => (
                    <option key={s.email} value={s.email}>
                      {s.displayName || s.fullName || s.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600">Date</label>
                <input
                  type="date"
                  required
                  value={form.entryDate}
                  onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))}
                  className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600">Clock in</label>
                <input
                  type="time"
                  required
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600">Clock out</label>
                <input
                  type="time"
                  required
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-zinc-600">Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. arrived late due to school"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : dates.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
          No clock entries for {formatMonthLabel(month)}.
        </p>
      ) : (
        <div className="space-y-4">
          {dates.map((d) => (
            <div key={d}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {formatDate(d)}
              </p>
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
                {byDate[d].map((entry) => {
                  const hours = computeHours(entry.startTime, entry.endTime);
                  const isEditing = editingId === entry.id;
                  return (
                    <li key={entry.id} className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-500">Date</label>
                            <input
                              type="date"
                              value={editForm.entryDate}
                              onChange={(e) => setEditForm((f) => ({ ...f, entryDate: e.target.value }))}
                              className="mt-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-500">Clock in</label>
                            <input
                              type="time"
                              value={editForm.startTime}
                              onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
                              className="mt-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-500">Clock out</label>
                            <input
                              type="time"
                              value={editForm.endTime}
                              onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
                              className="mt-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div className="flex-1 min-w-36">
                            <label className="block text-xs font-medium text-zinc-500">Notes</label>
                            <input
                              type="text"
                              value={editForm.notes}
                              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div className="flex gap-2 pb-0.5">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => saveEdit(entry.id)}
                              className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            {isOwnerView && (
                              <p className="text-xs font-semibold text-sky-700">
                                {entry.staffName || entry.staffEmail}
                              </p>
                            )}
                            <p className="font-medium text-zinc-900">
                              {entry.startTime} – {entry.endTime}
                              <span className="ml-2 text-sm font-normal text-zinc-500">
                                {formatHours(hours)}
                              </span>
                            </p>
                            {entry.notes && (
                              <p className="mt-0.5 text-xs text-zinc-500">{entry.notes}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              className="text-xs text-zinc-500 hover:text-zinc-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEntry(entry.id)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Monthly total */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
            <span className="font-semibold text-zinc-800">
              Total: {formatHours(totalHours)}
            </span>
            {visibleEntries.length > 0 && (
              <span className="ml-2 text-zinc-500">
                across {visibleEntries.length} session{visibleEntries.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
