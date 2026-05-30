"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  enrollment: {
    id: string;
    freeTrial: boolean;
    registrationFeeDue: boolean;
  };
  student: { id: string; name: string };
  class: { id: string; label: string; tutor: string };
};

type Student = { id: string; name: string };
type Klass = { id: string; label: string };

export default function EnrollmentsManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [eRes, sRes, cRes] = await Promise.all([
      fetch("/api/enrollments"),
      fetch("/api/students"),
      fetch("/api/classes"),
    ]);
    if (eRes.ok) {
      const data = (await eRes.json()) as { enrollments: Row[] };
      setRows(data.enrollments);
    }
    if (sRes.ok) {
      const data = (await sRes.json()) as { students: Student[] };
      setStudents(data.students);
    }
    if (cRes.ok) {
      const data = (await cRes.json()) as { classes: Klass[] };
      setClasses(data.classes);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onEnroll(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, classId }),
    });
    setStudentId("");
    setClassId("");
    load();
  }

  async function endEnrollment(id: string) {
    if (!confirm("End this enrollment?")) return;
    await fetch(`/api/enrollments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ end: true }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onEnroll}
        className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end"
      >
        <label className="flex-1 text-sm">
          Student
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            required
          >
            <option value="">Select</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-sm">
          Class
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            required
          >
            <option value="">Select</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white"
        >
          Enroll
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {rows.map(({ enrollment, student, class: cls }) => (
            <li
              key={enrollment.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <p className="font-medium text-zinc-900">{student.name}</p>
                <p className="text-sm text-zinc-600">
                  {cls.label} · {cls.tutor}
                  {enrollment.freeTrial && (
                    <span className="ml-2 text-blue-600">Free trial</span>
                  )}
                  {enrollment.registrationFeeDue && (
                    <span className="ml-2 text-amber-700">Reg fee</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => endEnrollment(enrollment.id)}
                className="text-sm text-zinc-500 hover:text-red-600"
              >
                End enrollment
              </button>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">
              No active enrollments.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
