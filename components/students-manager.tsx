"use client";

import { useCallback, useEffect, useState } from "react";

type Student = {
  id: string;
  name: string;
  contact: string;
  school: string;
  parentName: string;
  startDate: string | null;
  notes: string;
  archivedAt: string | null;
};

type Klass = { id: string; label: string; tutor: string; weekday: string };

const emptyForm = {
  name: "",
  contact: "",
  school: "",
  parentName: "",
  startDate: "",
  notes: "",
  classId: "",
  freeTrial: false,
  registrationFeeDue: false,
};

export default function StudentsManager() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/students?archived=${showArchived ? "1" : "0"}`),
      fetch("/api/classes"),
    ]);
    if (!sRes.ok) {
      setError("Failed to load students");
      setLoading(false);
      return;
    }
    const sData = (await sRes.json()) as { students: Student[] };
    setStudents(sData.students);
    if (cRes.ok) {
      const cData = (await cRes.json()) as { classes: Klass[] };
      setClasses(cData.classes);
    }
    setLoading(false);
  }, [showArchived]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed to register");
      return;
    }
    setForm(emptyForm);
    load();
  }

  async function archiveStudent(id: string) {
    if (!confirm("Archive this student? History is kept.")) return;
    await fetch(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    });
    load();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">Register new student</h2>
        <form onSubmit={onRegister} className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["name", "Name *", "text"],
              ["contact", "Contact", "text"],
              ["school", "School", "text"],
              ["parentName", "Parent", "text"],
              ["startDate", "Start date", "date"],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key} className="block text-sm">
              <span className="font-medium text-zinc-700">{label}</span>
              <input
                type={type}
                required={key === "name"}
                value={form[key]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              />
            </label>
          ))}
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-zinc-700">Class (optional)</span>
            <select
              value={form.classId}
              onChange={(e) =>
                setForm((f) => ({ ...f, classId: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            >
              <option value="">— Select later —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.weekday}) — {c.tutor}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.freeTrial}
              onChange={(e) =>
                setForm((f) => ({ ...f, freeTrial: e.target.checked }))
              }
            />
            Free trial
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.registrationFeeDue}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  registrationFeeDue: e.target.checked,
                }))
              }
            />
            Registration fee due
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-zinc-700">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={2}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 sm:col-span-2 sm:w-fit"
          >
            Add student
          </button>
        </form>
      </section>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-800">
            {showArchived ? "Archived students" : "Active students"} ({students.length})
          </h2>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
            {students.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-900">{s.name}</p>
                  <p className="text-sm text-zinc-600">
                    {s.contact || "—"} · {s.school || "—"}
                  </p>
                  {s.parentName && (
                    <p className="text-sm text-zinc-500">Parent: {s.parentName}</p>
                  )}
                </div>
                {!s.archivedAt && (
                  <button
                    type="button"
                    onClick={() => archiveStudent(s.id)}
                    className="text-sm text-zinc-500 hover:text-red-600"
                  >
                    Archive
                  </button>
                )}
              </li>
            ))}
            {students.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-zinc-500">
                No students yet. Register one above.
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
