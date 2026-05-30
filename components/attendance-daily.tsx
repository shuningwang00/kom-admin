"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SessionRow = {
  session: { id: string; scheduledDate: string; timeLabel: string };
  class: { label: string; tutor: string; time: string };
};

export default function AttendanceDaily() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [yearMonth, setYearMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<string>("admin");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/sessions?date=${date}`);
    setLoading(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Failed to load");
      return;
    }
    const data = (await res.json()) as {
      sessions: SessionRow[];
      role: string;
    };
    setSessions(data.sessions);
    setRole(data.role);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function generateMonth() {
    setError("");
    const res = await fetch("/api/sessions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearMonth }),
    });
    const data = (await res.json()) as { error?: string; result?: object };
    if (!res.ok) {
      setError(data.error ?? "Generate failed");
      return;
    }
    alert(`Sessions: ${JSON.stringify(data.result)}`);
    load();
  }

  return (
    <div className="space-y-6">
      {role === "owner" && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-800">
            Generate weekly sessions
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Creates one session per class on each matching weekday in the month.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={generateMonth}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white"
            >
              Generate
            </button>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {sessions.map(({ session, class: cls }) => (
            <li key={session.id}>
              <Link
                href={`/attendance/session/${session.id}`}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-zinc-900">{cls.label}</p>
                  <p className="text-sm text-zinc-600">{cls.tutor}</p>
                </div>
                <span className="text-sm text-zinc-500">
                  {session.timeLabel || cls.time}
                </span>
              </Link>
            </li>
          ))}
          {sessions.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">
              No sessions this day. Generate the month or pick another date.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
