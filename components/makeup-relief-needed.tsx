"use client";

import { formatShortDate } from "@/lib/attendance/makeup-display";
import type { ReliefTutorNeededRow } from "@/lib/attendance/makeup-hub";
import { MakeupCustomTutorSelect } from "@/components/makeup-custom-tutor-select";
import Link from "next/link";
import { useState } from "react";

export function MakeupReliefNeededSection({
  rows,
  saving,
  onAssign,
  onError,
}: {
  rows: ReliefTutorNeededRow[];
  saving: boolean;
  onAssign: (sessionId: string, reliefTutor: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [draftBySession, setDraftBySession] = useState<
    Record<string, string>
  >({});

  if (rows.length === 0) return null;

  async function save(sessionId: string, regularTutor: string) {
    const relief = draftBySession[sessionId] ?? "";
    if (!relief.trim()) {
      onError("Choose a relief tutor before saving.");
      return;
    }
    try {
      await onAssign(sessionId, relief.trim());
      setDraftBySession((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save relief tutor");
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-zinc-900">
        Relief tutor needed
        <span className="ml-2 text-sm font-normal text-sky-800">
          ({rows.length})
        </span>
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        Custom makeup sessions waiting for a covering tutor. Assign a name when
        you find one.
      </p>
      <ul className="mt-3 divide-y divide-sky-100 rounded-xl border border-sky-200 bg-sky-50/40 shadow-sm">
        {rows.map((row) => (
          <li key={row.sessionId} className="px-4 py-3 text-sm">
            <p className="font-medium text-zinc-900">
              {formatShortDate(row.scheduledDate)} ({row.makeupDayLabel}) ·{" "}
              {row.typeLabel}
              {row.timeLabel.trim() ? ` · ${row.timeLabel.trim()}` : ""}
              {row.students.length > 0
                ? ` · MU: ${row.students.map((s) => s.studentName).join(", ")}`
                : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="shrink-0 text-xs text-zinc-600">
                Original: <strong>{row.regularTutor.trim() || "—"}</strong>
              </span>
              <span className="shrink-0 text-xs text-zinc-600">Relief:</span>
              <div className="min-w-[160px] flex-1">
                <MakeupCustomTutorSelect
                  regularTutor={row.regularTutor}
                  reliefTutor={draftBySession[row.sessionId] ?? ""}
                  onReliefTutorChange={(relief) =>
                    setDraftBySession((prev) => ({
                      ...prev,
                      [row.sessionId]: relief,
                    }))
                  }
                  hideLabel
                  hideClassTutorOption
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => save(row.sessionId, row.regularTutor)}
                className="shrink-0 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
              >
                Save
              </button>
              <Link
                href={`/attendance/session/${row.sessionId}`}
                className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white"
              >
                Open session
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
