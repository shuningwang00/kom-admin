"use client";

import { SessionListPreview } from "@/components/session-list-preview";
import { formatShortDate } from "@/lib/attendance/makeup-display";
import { todayCalendarDate } from "@/lib/dates/calendar";
import {
  readAttendanceDailyDate,
  writeAttendanceDailyDate,
} from "@/lib/dates/attendance-selected-date";
import { isReliefTutorNeeded } from "@/lib/tutors/constants";
import { sessionTutorDisplay } from "@/lib/tutors/display";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type SessionRow = {
  session: {
    id: string;
    scheduledDate: string;
    timeLabel: string;
    reliefTutor: string;
  };
  class: { label: string; level: string; tutor: string; time: string };
  expectedLabel: string;
  attendanceMarked: boolean;
  attendanceMarkLabel: string;
};

function expectedLabelColor(label: string): string {
  if (!label || label.startsWith("0 ")) return "text-red-600";
  if (label.includes("M/U")) return "text-amber-500";
  return "text-blue-600";
}

export default function AttendanceDaily() {
  const [date, setDate] = useState(() => readAttendanceDailyDate());

  useEffect(() => {
    const stored = readAttendanceDailyDate();
    setDate((current) => (current === stored ? current : stored));
  }, []);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [yearMonth, setYearMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [role, setRole] = useState<string>("admin");
  const [canGenerateSessions, setCanGenerateSessions] = useState(false);
  const permFetched = useRef(false);
  const [showUnmarkedPast, setShowUnmarkedPast] = useState(false);
  const [unmarkedPast, setUnmarkedPast] = useState<SessionRow[]>([]);
  const [unmarkedLoading, setUnmarkedLoading] = useState(false);
  const [unmarkedError, setUnmarkedError] = useState("");

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

  useEffect(() => {
    if (permFetched.current) return;
    permFetched.current = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user?: { role?: string }; permissions?: { staff?: { generateSessions?: boolean } } } | null) => {
        if (!data) return;
        const isOwner = data.user?.role === "owner";
        const staffCanGenerate = data.permissions?.staff?.generateSessions === true;
        setCanGenerateSessions(isOwner || staffCanGenerate);
      })
      .catch(() => { /* ignore */ });
  }, []);

  const loadUnmarkedPast = useCallback(async () => {
    setUnmarkedLoading(true);
    setUnmarkedError("");
    const today = todayCalendarDate();
    const res = await fetch(
      `/api/sessions/unmarked-past?before=${encodeURIComponent(today)}`,
    );
    setUnmarkedLoading(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setUnmarkedError(data.error ?? "Failed to load unmarked sessions");
      return;
    }
    const data = (await res.json()) as { sessions: SessionRow[] };
    setUnmarkedPast(data.sessions);
  }, []);

  async function toggleUnmarkedPast() {
    const next = !showUnmarkedPast;
    setShowUnmarkedPast(next);
    if (next && unmarkedPast.length === 0 && !unmarkedLoading) {
      await loadUnmarkedPast();
    }
  }

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
      {canGenerateSessions && (
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
            onChange={(e) => {
              const next = e.target.value;
              setDate(next);
              writeAttendanceDailyDate(next);
            }}
            className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2"
          />
        </label>
        <button
          type="button"
          onClick={() => void toggleUnmarkedPast()}
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
        >
          {showUnmarkedPast
            ? "Hide unmarked past sessions"
            : "Show unmarked past sessions"}
        </button>
      </div>

      {showUnmarkedPast && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-amber-950">
                Past sessions — attendance not marked
              </h2>
              <p className="mt-0.5 text-xs text-amber-900/80">
                Lessons before today ({formatShortDate(todayCalendarDate())})
                that still need marking. Today and future dates are not listed.
              </p>
            </div>
            <button
              type="button"
              disabled={unmarkedLoading}
              onClick={() => void loadUnmarkedPast()}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
            >
              {unmarkedLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
          {unmarkedError && (
            <p className="px-4 py-2 text-sm text-red-600">{unmarkedError}</p>
          )}
          {unmarkedLoading && unmarkedPast.length === 0 ? (
            <p className="px-4 py-6 text-sm text-amber-900/70">Loading…</p>
          ) : unmarkedPast.length === 0 ? (
            <p className="px-4 py-6 text-sm text-amber-900/80">
              No past sessions waiting for attendance — all caught up.
            </p>
          ) : (
            <ul className="divide-y divide-amber-200/60">
              {unmarkedPast.map(
                ({
                  session,
                  class: cls,
                  expectedLabel,
                  attendanceMarkLabel,
                }) => {
                  const tutor = sessionTutorDisplay(
                    cls.tutor,
                    session.reliefTutor ?? "",
                  );
                  const reliefNeeded = isReliefTutorNeeded(session.reliefTutor ?? "");
                  return (
                    <li key={session.id}>
                      <Link
                        href={`/attendance/session/${session.id}`}
                        className="flex flex-col gap-1 px-4 py-3 hover:bg-amber-100/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <SessionListPreview
                            cls={cls}
                            tutorPrimary={`${formatShortDate(session.scheduledDate)} · ${tutor.primary}`}
                            tutorSubtitle={tutor.subtitle}
                            isReliefNeeded={reliefNeeded}
                          />
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-zinc-500">
                            {session.timeLabel || cls.time}
                          </p>
                          <p className={`mt-0.5 font-medium ${expectedLabelColor(expectedLabel)}`}>
                            {expectedLabel}
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-amber-800">
                            {attendanceMarkLabel}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                },
              )}
            </ul>
          )}
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {sessions.map(
            ({
              session,
              class: cls,
              expectedLabel,
              attendanceMarked,
              attendanceMarkLabel,
            }) => {
            const tutor = sessionTutorDisplay(cls.tutor, session.reliefTutor ?? "");
            const reliefNeeded = isReliefTutorNeeded(session.reliefTutor ?? "");
            return (
            <li key={session.id}>
              <Link
                href={`/attendance/session/${session.id}`}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <SessionListPreview
                    cls={cls}
                    tutorPrimary={tutor.primary}
                    tutorSubtitle={tutor.subtitle}
                    isReliefNeeded={reliefNeeded}
                  />
                </div>
                <div className="text-right text-sm">
                  <p className="text-zinc-500">
                    {session.timeLabel || cls.time}
                  </p>
                  <p className={`mt-0.5 font-medium ${expectedLabelColor(expectedLabel)}`}>
                    {expectedLabel}
                  </p>
                  <p
                    className={`mt-0.5 text-xs font-medium ${
                      attendanceMarkLabel === "—"
                        ? "text-zinc-400"
                        : attendanceMarked
                          ? "text-green-700"
                          : "text-amber-800"
                    }`}
                  >
                    {attendanceMarkLabel === "—"
                      ? "No students to mark"
                      : attendanceMarked
                        ? "Attendance marked"
                        : "Attendance not marked"}
                  </p>
                </div>
              </Link>
            </li>
            );
          },
          )}
          {sessions.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">
              No classes with enrolled students on this day. Enroll students,
              generate sessions for the month, or pick another date.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
