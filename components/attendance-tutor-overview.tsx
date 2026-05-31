"use client";

import { SessionListPreview } from "@/components/session-list-preview";
import { sessionTutorDisplay } from "@/lib/tutors/display";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Group = {
  class: { id: string; label: string; level: string; tutor: string; time: string };
  sessions: Array<{
    id: string;
    scheduledDate: string;
    timeLabel: string;
    reliefTutor: string;
    expectedLabel: string;
    attendanceMarked: boolean;
    attendanceMarkLabel: string;
  }>;
};

export default function AttendanceTutorOverview() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sessions/tutor-overview");
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed");
      return;
    }
    const data = (await res.json()) as { groups: Group[] };
    setGroups(data.groups);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600">
        All your classes and upcoming sessions. Tap a session to mark attendance.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const classTutor = sessionTutorDisplay(g.class.tutor, "");
            return (
            <section
              key={g.class.id}
              className="rounded-xl border border-zinc-200 bg-white shadow-sm"
            >
              <div className="border-b border-zinc-100 px-4 py-3">
                <SessionListPreview
                  cls={g.class}
                  tutorPrimary={classTutor.primary}
                  titleClassName="font-semibold text-zinc-900"
                />
              </div>
              <ul className="divide-y divide-zinc-50">
                {g.sessions.map((s) => {
                  const tutor = sessionTutorDisplay(
                    g.class.tutor,
                    s.reliefTutor ?? "",
                  );
                  return (
                  <li key={s.id}>
                    <Link
                      href={`/attendance/session/${s.id}`}
                      className="flex justify-between gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50"
                    >
                      <span>
                        {s.scheduledDate}
                        {tutor.subtitle && (
                          <span className="mt-0.5 block text-xs text-sky-800">
                            Relief: {tutor.primary}
                          </span>
                        )}
                      </span>
                      <span className="text-right">
                        <span className="block text-zinc-500">
                          {s.timeLabel || g.class.time}
                        </span>
                        <span className="block font-medium text-orange-800">
                          {s.expectedLabel}
                        </span>
                        <span
                          className={`mt-0.5 block text-xs font-medium ${
                            s.attendanceMarkLabel === "—"
                              ? "text-zinc-400"
                              : s.attendanceMarked
                                ? "text-green-700"
                                : "text-amber-800"
                          }`}
                        >
                          {s.attendanceMarkLabel === "—"
                            ? "No students to mark"
                            : s.attendanceMarked
                              ? "Attendance marked"
                              : "Attendance not marked"}
                        </span>
                      </span>
                    </Link>
                  </li>
                  );
                })}
              </ul>
            </section>
            );
          })}
          {groups.length === 0 && (
            <p className="text-sm text-zinc-500">
              No sessions found. Check your tutor match on the allowlist or ask
              admin to generate sessions.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
