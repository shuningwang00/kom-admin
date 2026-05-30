"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Group = {
  class: { id: string; label: string; tutor: string; time: string };
  sessions: Array<{ id: string; scheduledDate: string; timeLabel: string }>;
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
          {groups.map((g) => (
            <section
              key={g.class.id}
              className="rounded-xl border border-zinc-200 bg-white shadow-sm"
            >
              <div className="border-b border-zinc-100 px-4 py-3">
                <p className="font-semibold text-zinc-900">{g.class.label}</p>
                <p className="text-sm text-zinc-600">{g.class.tutor}</p>
              </div>
              <ul className="divide-y divide-zinc-50">
                {g.sessions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/attendance/session/${s.id}`}
                      className="flex justify-between px-4 py-2.5 text-sm hover:bg-zinc-50"
                    >
                      <span>{s.scheduledDate}</span>
                      <span className="text-zinc-500">
                        {s.timeLabel || g.class.time}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
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
