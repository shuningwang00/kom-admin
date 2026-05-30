"use client";

import { useCallback, useEffect, useState } from "react";

type Klass = {
  id: string;
  label: string;
  level: string;
  time: string;
  tutor: string;
  weekday: string;
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
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/classes?all=1");
    if (!res.ok) {
      setError("Failed to load classes");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { classes: Klass[]; weekdays: string[] };
    setClasses(data.classes);
    setWeekdays(data.weekdays);
    setLoading(false);
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

  return (
    <div className="space-y-6">
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
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {classes.map((c) => (
            <li key={c.id} className="px-4 py-3">
              <p className="font-medium text-zinc-900">{c.label}</p>
              <p className="text-sm text-zinc-600">
                {c.weekday} · {c.tutor || "—"} · {c.time || "—"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
