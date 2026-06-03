"use client";

import { SessionListPreview } from "@/components/session-list-preview";
import { formatShortDate } from "@/lib/attendance/makeup-display";
import { todayCalendarDate } from "@/lib/dates/calendar";
import {
  readAttendanceDailyDate,
  writeAttendanceDailyDate,
} from "@/lib/dates/attendance-selected-date";
import { sessionShowsReliefTutorNeeded } from "@/lib/attendance/relief-tutor-session";
import type { SessionExpectedCounts } from "@/lib/attendance/session-expected-labels";
import { sessionTutorDisplay } from "@/lib/tutors/display";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { fetcher } from "@/lib/swr";
import { SkeletonList } from "@/components/skeleton";
import { useState } from "react";

type SessionRow = {
  session: {
    id: string;
    scheduledDate: string;
    timeLabel: string;
    status?: "scheduled" | "cancelled";
    reliefTutor: string;
    rescheduleNote?: string;
  };
  class: { label: string; level: string; tutor: string; time: string };
  expectedLabel: string;
  expected: SessionExpectedCounts;
  attendanceMarked: boolean;
  attendanceMarkLabel: string;
};

type HolSessionRow = {
  sessionId: string;
  programmeId: string;
  programmeName: string;
  tutorName: string;
  timeLabel: string;
  scheduledDate?: string;
  participantCount?: number;
  newCount: number;
  existingCount: number;
  waivedCount?: number;
};

function expectedLabelColor(label: string): string {
  if (label.includes("M/U")) return "text-amber-500";
  if (!label || label.startsWith("0 ")) return "text-red-600";
  return "text-blue-600";
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

function formatDayHeader(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-SG", { weekday: "short", day: "2-digit", month: "short" });
}

function to12h(h: number, m: string): string {
  const period = h >= 12 ? "pm" : "am";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === "00" ? `${h12}${period}` : `${h12}:${m}${period}`;
}

function formatHolTimeLabel(label: string): string {
  const trimmed = label.trim();
  // Only reformat plain 24h ranges like "15:00 - 17:00" or "15:00-17:00"
  const m = trimmed.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
  if (!m) return trimmed;
  return `${to12h(Number(m[1]), m[2])} - ${to12h(Number(m[3]), m[4])}`;
}

type DayData = {
  sessions: SessionRow[];
  holSessions: HolSessionRow[];
  role: string;
  canGenerateSessions: boolean;
};
type MonthData = { sessions: SessionRow[]; holSessions: HolSessionRow[] };
type UnmarkedData = { sessions: SessionRow[] };

export default function AttendanceDaily() {
  const [viewMode, setViewMode] = useState<"day" | "month">("day");
  const [date, setDate] = useState(() => readAttendanceDailyDate());
  const [yearMonth, setYearMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [showUnmarkedPast, setShowUnmarkedPast] = useState(false);
  const [monthViewMonth, setMonthViewMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [actionError, setActionError] = useState("");

  const today = todayCalendarDate();

  const { data: dayData, isLoading: loading, error: loadError } =
    useSWR<DayData>(`/api/sessions?date=${date}`, fetcher);
  const { data: monthData, isLoading: monthLoading, error: monthError } =
    useSWR<MonthData>(
      viewMode === "month" ? `/api/sessions?month=${monthViewMonth}` : null,
      fetcher,
    );
  const {
    data: unmarkedData,
    isLoading: unmarkedLoading,
    error: unmarkedError,
    mutate: refreshUnmarked,
  } = useSWR<UnmarkedData>(
    showUnmarkedPast
      ? `/api/sessions/unmarked-past?before=${encodeURIComponent(today)}`
      : null,
    fetcher,
  );

  const sessions = dayData?.sessions ?? [];
  const holSessions = dayData?.holSessions ?? [];
  const role = dayData?.role ?? "admin";
  const canGenerateSessions = dayData?.canGenerateSessions ?? false;
  const monthSessions = monthData?.sessions ?? [];
  const monthHolSessions = monthData?.holSessions ?? [];
  const unmarkedPast = unmarkedData?.sessions ?? [];

  function toggleUnmarkedPast() {
    setShowUnmarkedPast((v) => !v);
  }

  async function generateMonth() {
    setActionError("");
    const res = await fetch("/api/sessions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearMonth }),
    });
    const data = (await res.json()) as { error?: string; result?: object };
    if (!res.ok) {
      setActionError(data.error ?? "Generate failed");
      return;
    }
    alert(`Sessions: ${JSON.stringify(data.result)}`);
    await globalMutate(`/api/sessions?date=${date}`);
  }

  // Group month sessions by date for month view
  const monthByDate = monthSessions.reduce<Record<string, SessionRow[]>>((acc, row) => {
    const d = row.session.scheduledDate;
    if (!acc[d]) acc[d] = [];
    acc[d].push(row);
    return acc;
  }, {});
  const monthHolByDate = monthHolSessions.reduce<Record<string, HolSessionRow[]>>((acc, row) => {
    const d = row.scheduledDate;
    if (!d) return acc;
    if (!acc[d]) acc[d] = [];
    acc[d].push(row);
    return acc;
  }, {});
  const monthDates = [...new Set([...Object.keys(monthByDate), ...Object.keys(monthHolByDate)])].sort();

  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-zinc-200 p-0.5 text-xs">
          {(["day", "month"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className={`rounded-md px-3 py-1.5 capitalize font-medium ${
                viewMode === m ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "month" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthViewMonth(prevMonth(monthViewMonth))}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >←</button>
            <span className="min-w-40 text-center text-sm font-semibold text-zinc-800">
              {formatMonthLabel(monthViewMonth)}
            </span>
            <button
              type="button"
              onClick={() => setMonthViewMonth(nextMonth(monthViewMonth))}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >→</button>
            <button
              type="button"
              onClick={() => setMonthViewMonth(today.slice(0, 7))}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50"
            >Today</button>
          </div>
          {monthError && <p className="text-sm text-red-600">{monthError.message}</p>}
          {monthLoading ? (
            <SkeletonList count={5} />
          ) : monthDates.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 shadow-sm">
              No sessions with enrolled students this month.
            </p>
          ) : (
            <div className="space-y-4">
              {monthDates.map((d) => {
                const daySessions = monthByDate[d] ?? [];
                const dayHolSessions = monthHolByDate[d] ?? [];
                const isToday = d === today;
                return (
                  <div key={d}>
                    <p className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${isToday ? "text-orange-600" : "text-zinc-500"}`}>
                      {formatDayHeader(d)}{isToday && " · Today"}
                    </p>
                    <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
                      {daySessions.map(({ session, class: cls, expected, expectedLabel, attendanceMarked, attendanceMarkLabel }) => {
                        const tutor = sessionTutorDisplay(cls.tutor, session.reliefTutor ?? "");
                        const reliefNeeded = sessionShowsReliefTutorNeeded(session.reliefTutor, expected);
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
                                {session.rescheduleNote && (
                                  <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
                                      {session.status === "cancelled" ? "Cancelled" : "Rescheduled"}
                                    </span>
                                    <span className="text-zinc-500">{session.rescheduleNote}</span>
                                  </p>
                                )}
                              </div>
                              <div className="text-right text-sm">
                                <p className="text-zinc-500">{session.timeLabel || cls.time}</p>
                                <p className={`mt-0.5 font-medium ${expectedLabelColor(expectedLabel)}`}>{expectedLabel}</p>
                                <p className={`mt-0.5 text-xs font-medium ${
                                  attendanceMarkLabel === "Cancelled" ? "text-zinc-500"
                                  : attendanceMarkLabel === "—" ? "text-zinc-400"
                                  : attendanceMarked ? "text-green-700" : "text-amber-800"
                                }`}>
                                  {attendanceMarkLabel === "—" ? "No students to mark"
                                    : attendanceMarked ? "Attendance marked" : "Attendance not marked"}
                                </p>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                      {dayHolSessions.map((hs) => (
                        <li key={hs.sessionId}>
                          <Link
                            href={`/attendance/hol-session/${hs.sessionId}`}
                            className="flex flex-col gap-1 px-4 py-3 hover:bg-purple-50 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="flex flex-wrap items-center gap-2 font-medium text-zinc-900">
                                {hs.programmeName}
                                <span className="inline-flex items-center rounded-full border border-purple-300 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-900">
                                  Holiday Programme
                                </span>
                              </p>
                              {hs.tutorName && (
                                <p className="text-sm text-zinc-500">{hs.tutorName}</p>
                              )}
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-zinc-500">{formatHolTimeLabel(hs.timeLabel)}</p>
                              <p className="mt-0.5 font-medium text-blue-600">
                                {hs.newCount} new + {hs.existingCount} existing
                              </p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === "day" && canGenerateSessions && (
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

      {viewMode === "day" && <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Date
          <div className="mt-1 flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => {
                const next = e.target.value;
                setDate(next);
                writeAttendanceDailyDate(next);
              }}
              className="block rounded-lg border border-zinc-300 px-3 py-2"
            />
            <button
              type="button"
              onClick={() => {
                const today = todayCalendarDate();
                setDate(today);
                writeAttendanceDailyDate(today);
              }}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Today
            </button>
          </div>
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
              onClick={() => void refreshUnmarked()}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
            >
              {unmarkedLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
          {unmarkedError && (
            <p className="px-4 py-2 text-sm text-red-600">{unmarkedError.message}</p>
          )}
          {unmarkedLoading && unmarkedPast.length === 0 ? (
            <div className="p-4"><SkeletonList count={3} /></div>
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
                  expected,
                  expectedLabel,
                  attendanceMarkLabel,
                }) => {
                  const tutor = sessionTutorDisplay(
                    cls.tutor,
                    session.reliefTutor ?? "",
                  );
                  const reliefNeeded = sessionShowsReliefTutorNeeded(
                    session.reliefTutor,
                    expected,
                  );
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
                          {session.rescheduleNote && (
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
                                {session.status === "cancelled" ? "Cancelled" : "Rescheduled"}
                              </span>
                              <span className="text-zinc-500">{session.rescheduleNote}</span>
                            </p>
                          )}
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

      {(loadError || actionError) && (
        <p className="text-sm text-red-600">{loadError?.message ?? actionError}</p>
      )}

      {loading ? (
        <SkeletonList count={4} />
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {sessions.map(
            ({
              session,
              class: cls,
              expected,
              expectedLabel,
              attendanceMarked,
              attendanceMarkLabel,
            }) => {
            const tutor = sessionTutorDisplay(cls.tutor, session.reliefTutor ?? "");
            const reliefNeeded = sessionShowsReliefTutorNeeded(
              session.reliefTutor,
              expected,
            );
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
                  {session.rescheduleNote && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
                        Rescheduled
                      </span>
                      <span className="text-zinc-500">{session.rescheduleNote}</span>
                    </p>
                  )}
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
                      attendanceMarkLabel === "Cancelled"
                        ? "text-zinc-500"
                        : attendanceMarkLabel === "—"
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
          {sessions.length === 0 && holSessions.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">
              No classes with enrolled students on this day. Enroll students,
              generate sessions for the month, or pick another date.
            </li>
          )}
        </ul>
      )}

      {holSessions.length > 0 && (
        <ul className="divide-y divide-purple-100 rounded-xl border border-purple-200 bg-white shadow-sm">
          {holSessions.map((hs) => (
            <li key={hs.sessionId}>
              <Link
                href={`/attendance/hol-session/${hs.sessionId}`}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-purple-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-medium text-zinc-900">
                    {hs.programmeName}
                    <span className="inline-flex items-center rounded-full border border-purple-300 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-900">
                      Holiday Programme
                    </span>
                  </p>
                  {hs.tutorName && (
                    <p className="text-sm text-zinc-500">{hs.tutorName}</p>
                  )}
                </div>
                <div className="text-right text-sm">
                  <p className="text-zinc-500">{formatHolTimeLabel(hs.timeLabel)}</p>
                  <p className="mt-0.5 font-medium text-blue-600">
                    {hs.newCount} new + {hs.existingCount} existing
                    {(hs.waivedCount ?? 0) > 0 && (
                      <span className="font-normal text-zinc-400"> · {hs.waivedCount} waived</span>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      </div>}
    </div>
  );
}
