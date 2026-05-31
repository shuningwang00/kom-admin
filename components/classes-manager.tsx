"use client";

import {
  formatClassTypeLabel,
  formatWeekdayLabel,
} from "@/lib/classes/display-label";

import { useCallback, useEffect, useState } from "react";

type Klass = {
  id: string;
  label: string;
  level: string;
  time: string;
  tutor: string;
  weekday: string;
  isActive: boolean;
};

export default function ClassesManager() {
  const [classes, setClasses] = useState<Klass[]>([]);
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [form, setForm] = useState({
    label: "",
    level: "",
    time: "",
    tutor: "",
    weekday: "other",
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [syncNote, setSyncNote] = useState("");

  const load = useCallback(async (refreshSheet = false) => {
    setLoading(true);
    const res = await fetch(
      `/api/classes?all=1${refreshSheet ? "&refresh=1" : ""}`,
    );
    if (!res.ok) {
      setError("Failed to load classes");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as {
      classes: Klass[];
      weekdays: string[];
      sheetSync?: { synced: boolean; source?: string; syncedAt?: string };
    };
    setClasses(data.classes);
    setWeekdays(data.weekdays);
    if (data.sheetSync?.synced) {
      setSyncNote(
        `Updated from Google Sheet (${data.sheetSync.source ?? "sheet"}).`,
      );
    }
    setLoading(false);
    setSyncing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed");
      return;
    }
    setForm({ label: "", level: "", time: "", tutor: "", weekday: "other" });
    load();
  }

  async function refreshFromSheet() {
    setSyncing(true);
    setError("");
    await load(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <p className="text-sm text-zinc-600">
          Class dropdowns (students, trials, enrollments) use the database. Sync
          from your classes Google Sheet when the timetable changes — usually once
          a day is enough.
        </p>
        <button
          type="button"
          onClick={refreshFromSheet}
          disabled={syncing || loading}
          className="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {syncing ? "Syncing…" : "Sync from sheet"}
        </button>
      </div>
      {syncNote ? (
        <p className="text-sm text-green-800">{syncNote}</p>
      ) : null}
      <form
        onSubmit={onAdd}
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2"
      >
        <h2 className="text-sm font-semibold text-zinc-800 sm:col-span-2">
          Add class
        </h2>
        <input
          placeholder="Full label (black row text)"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
          required
        />
        <input
          placeholder="Level"
          value={form.level}
          onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Time"
          value={form.time}
          onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Tutor"
          value={form.tutor}
          onChange={(e) => setForm((f) => ({ ...f, tutor: e.target.value }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <select
          value={form.weekday}
          onChange={(e) => setForm((f) => ({ ...f, weekday: e.target.value }))}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          {weekdays.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white sm:col-span-2 sm:w-fit"
        >
          Add class
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : classes.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
          No classes yet. Sync from sheet or add one above.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[40rem] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-3 py-2 font-semibold text-zinc-800">Day</th>
                  <th className="px-3 py-2 font-semibold text-zinc-800">Type</th>
                  <th className="px-3 py-2 font-semibold text-zinc-800">Time</th>
                  <th className="px-3 py-2 font-semibold text-zinc-800">Tutor</th>
                  <th className="px-3 py-2 font-semibold text-zinc-800">Status</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                  >
                    <td className="px-3 py-3 font-medium text-zinc-900">
                      {formatWeekdayLabel(c.weekday)}
                    </td>
                    <td className="px-3 py-3 text-zinc-800">
                      {formatClassTypeLabel(c)}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      {c.time.trim() || "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      {c.tutor.trim() || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          c.isActive
                            ? "inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                            : "inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
                        }
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500">
            {classes.length} class{classes.length === 1 ? "" : "es"} · includes
            inactive rows from sheet sync
          </p>
        </div>
      )}
    </div>
  );
}
