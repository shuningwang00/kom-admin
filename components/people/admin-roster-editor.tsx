"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  defaultRosterShiftTimes,
  suggestedAvailabilityMonth,
} from "@/lib/centre-hours";
import {
  formatRosterHours,
  summarizeRosterHoursByStaff,
} from "@/lib/people/admin-roster";

type Shift = {
  id: string;
  shiftDate: string;
  staffEmail: string;
  staffName: string;
  startTime: string;
  endTime: string;
  published: boolean;
};

type Staff = { email: string; displayName: string };
type Avail = { staffEmail: string; availDate: string; startTime: string; endTime: string };

export default function AdminRosterEditor() {
  const [month, setMonth] = useState(suggestedAvailabilityMonth());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [availability, setAvailability] = useState<Avail[]>([]);
  const [alerts, setAlerts] = useState<Array<{ type: string; message: string; shiftId?: string }>>([]);
  const [shiftDate, setShiftDate] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [startTime, setStartTime] = useState("15:00");
  const [endTime, setEndTime] = useState("20:00");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editStaffEmail, setEditStaffEmail] = useState("");
  const [editStartTime, setEditStartTime] = useState("15:00");
  const [editEndTime, setEditEndTime] = useState("20:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async (m: string) => {
    const res = await fetch(`/api/admin-roster/alerts?month=${m}`);
    if (res.ok) {
      const json = (await res.json()) as { alerts: Array<{ type: string; message: string }> };
      setAlerts(json.alerts ?? []);
    }
  }, []);

  const load = useCallback(async (m: string) => {
    setError(null);
    const res = await fetch(`/api/admin-roster?month=${m}`);
    const json = (await res.json()) as {
      shifts?: Shift[];
      staff?: Staff[];
      availability?: Avail[];
      error?: string;
    };
    if (!res.ok) throw new Error(json.error ?? "Failed");
    setShifts(json.shifts ?? []);
    setStaff(json.staff ?? []);
    setAvailability(json.availability ?? []);
    await loadAlerts(m);
  }, [loadAlerts]);

  useEffect(() => {
    load(month).catch((e) =>
      setError(e instanceof Error ? e.message : "Failed"),
    );
  }, [month, load]);

  useEffect(() => {
    if (!shiftDate) return;
    const { startTime: s, endTime: e } = defaultRosterShiftTimes(shiftDate);
    setStartTime(s);
    setEndTime(e);
  }, [shiftDate]);

  async function addShift(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftDate,
          staffEmail,
          startTime,
          endTime,
          published: true,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await load(month);
      setShiftDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(shift: Shift) {
    setEditingId(shift.id);
    setEditDate(shift.shiftDate);
    setEditStaffEmail(shift.staffEmail);
    setEditStartTime(shift.startTime);
    setEditEndTime(shift.endTime);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const shift = shifts.find((s) => s.id === editingId);
      const res = await fetch(`/api/admin-roster/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftDate: editDate,
          staffEmail: editStaffEmail,
          startTime: editStartTime,
          endTime: editEndTime,
          published: shift?.published ?? true,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      cancelEdit();
      await load(month);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeShift(id: string) {
    if (editingId === id) cancelEdit();
    setSaving(true);
    await fetch(`/api/admin-roster/${id}`, { method: "DELETE" });
    await load(month);
    setSaving(false);
  }

  async function publishMonth(publish: boolean) {
    setSaving(true);
    await fetch("/api/admin-roster", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, publish }),
    });
    await load(month);
    setSaving(false);
  }

  const conflicts = alerts.filter((a) => a.type === "conflict");
  const conflictShiftIds = new Set(conflicts.map((a) => a.shiftId).filter(Boolean) as string[]);
  const gaps = alerts.filter(
    (a) => a.type === "no_admin_has_class" || a.type === "no_admin_no_class",
  );
  const missing = alerts.filter((a) => a.type === "missing_submission");

  const hoursByStaff = useMemo(
    () => summarizeRosterHoursByStaff(shifts),
    [shifts],
  );
  const totalScheduledHours = useMemo(
    () => hoursByStaff.reduce((sum, row) => sum + row.totalHours, 0),
    [hoursByStaff],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Admin roster</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Schedule on the Calendar tab (click a day) to see lessons and admin duty
          together. Published shifts appear for everyone (purple). Draft shifts are
          visible to you only until you publish the month. Menu alerts flag
          availability conflicts.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => publishMonth(true)}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Publish month
          </button>
        </div>
      </section>

      {(conflicts.length > 0 || gaps.length > 0 || missing.length > 0) && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <h3 className="font-semibold text-amber-900">Owner dashboard</h3>
          {conflicts.length > 0 && (
            <>
              <p className="mt-2 font-medium text-red-800">
                {conflicts.length} roster conflict(s) — staff no longer available
              </p>
              <ul className="mt-1 list-inside list-disc text-red-800">
                {conflicts.map((a, i) => (
                  <li key={i}>{a.message}</li>
                ))}
              </ul>
            </>
          )}
          {missing.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-amber-900">
              {missing.slice(0, 5).map((a, i) => (
                <li key={i}>{a.message}</li>
              ))}
            </ul>
          )}
          {gaps.length > 0 && (
            <p className="mt-2 text-amber-800">
              {gaps.filter((g) => g.type === "no_admin_has_class").length} day(s)
              with classes but no admin ·{" "}
              {gaps.filter((g) => g.type === "no_admin_no_class").length} day(s)
              with no admin (no classes)
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-5">
        <h3 className="text-sm font-semibold text-violet-900">
          Scheduled hours — {month}
        </h3>
        <p className="mt-1 text-xs text-violet-800/80">
          Total admin duty in this roster (all shifts, including drafts).
        </p>
        {hoursByStaff.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No shifts scheduled yet.</p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-violet-200/80 rounded-lg border border-violet-200 bg-white text-sm">
              {hoursByStaff.map((row) => (
                <li
                  key={row.staffEmail}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <span className="font-medium text-zinc-900">
                    {row.staffName}
                  </span>
                  <span className="text-zinc-600">
                    <span className="font-semibold text-violet-800">
                      {formatRosterHours(row.totalHours)}
                    </span>
                    <span className="text-zinc-400">
                      {" "}
                      · {row.shiftCount} shift
                      {row.shiftCount === 1 ? "" : "s"}
                    </span>
                  </span>
                </li>
              ))}
              <li className="flex flex-wrap items-center justify-between gap-2 bg-violet-50 px-3 py-2.5 font-medium text-violet-900">
                <span>Total</span>
                <span>
                  {formatRosterHours(totalScheduledHours)}
                  <span className="font-normal text-violet-700/80">
                    {" "}
                    · {shifts.length} shift{shifts.length === 1 ? "" : "s"}
                  </span>
                </span>
              </li>
            </ul>
          </>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-zinc-800">Add shift</h3>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <form onSubmit={addShift} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input type="date" required value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
          <select required value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
            <option value="">Staff</option>
            {staff.map((s) => (
              <option key={s.email} value={s.email}>{s.displayName}</option>
            ))}
          </select>
          <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
          <input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm" />
          <button type="submit" disabled={saving} className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Add
          </button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">
          {availability.length} availability slot(s) loaded for this month.
        </p>
      </section>

      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm">
        {shifts.map((s) =>
          editingId === s.id ? (
            <li key={s.id} className="px-4 py-3">
              <form onSubmit={saveEdit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                />
                <select
                  required
                  value={editStaffEmail}
                  onChange={(e) => setEditStaffEmail(e.target.value)}
                  className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  {staff.map((member) => (
                    <option key={member.email} value={member.email}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  required
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="time"
                  required
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={cancelEdit}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </li>
          ) : (
            <li
              key={s.id}
              className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 ${
                conflictShiftIds.has(s.id) ? "bg-red-50" : ""
              }`}
            >
              <span>
                <span className={`font-medium ${conflictShiftIds.has(s.id) ? "text-red-700" : "text-violet-800"}`}>
                  {s.staffName}
                </span>
                <span className={conflictShiftIds.has(s.id) ? "text-red-600/80" : "text-zinc-500"}>
                  {" "}
                  · {s.shiftDate} · {s.startTime}–{s.endTime}
                </span>
                {!s.published && (
                  <span className="ml-2 text-xs text-amber-600">draft</span>
                )}
                {conflictShiftIds.has(s.id) && (
                  <span className="ml-2 text-xs font-semibold text-red-700">⚑ no longer available</span>
                )}
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => startEdit(s)}
                  className="text-xs text-violet-700 hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeShift(s.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ),
        )}
        {shifts.length === 0 && (
          <li className="px-4 py-6 text-center text-zinc-400">No shifts yet.</li>
        )}
      </ul>
    </div>
  );
}
