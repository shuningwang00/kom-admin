"use client";

import type { StudentRosterItem } from "@/lib/students/roster";

export function StudentsWithdrawnTable({
  students,
  onReinstate,
}: {
  students: StudentRosterItem[];
  onReinstate: (enrollmentId: string, studentName: string, classLabel: string) => void;
}) {
  const rows = students.flatMap((s) =>
    s.withdrawnEnrollments.map((e) => ({
      studentId: s.id,
      studentName: s.name,
      enrollmentId: e.id,
      classLabel: e.classLabel,
      endedAt: e.endedAt,
      startedAt: e.startedAt,
    })),
  );

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
        No withdrawn enrollments.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
          <tr>
            <th className="px-4 py-3">Student</th>
            <th className="px-4 py-3">Class</th>
            <th className="px-4 py-3">Withdrawn</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => (
            <tr key={row.enrollmentId}>
              <td className="px-4 py-3 font-medium text-zinc-900">
                {row.studentName}
              </td>
              <td className="px-4 py-3 text-zinc-700">{row.classLabel}</td>
              <td className="px-4 py-3 text-zinc-600">
                {row.endedAt ?? "—"}
                {row.startedAt && (
                  <span className="block text-xs text-zinc-500">
                    Started {row.startedAt}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() =>
                    onReinstate(
                      row.enrollmentId,
                      row.studentName,
                      row.classLabel,
                    )
                  }
                  className="text-sm font-medium text-orange-700 hover:underline"
                >
                  Undo withdraw
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
