"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  CalendarAdminShift,
  CalendarMonthData,
  CalendarSessionItem,
  DayCoverageStatus,
} from "@/lib/calendar/month-data";

// ─── helpers ────────────────────────────────────────────────────────────────

function todayYearMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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
  return new Date(y, m - 1, 1).toLocaleDateString("en-SG", {
    month: "long",
    year: "numeric",
  });
}

function isoToDayOfWeek(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-SG", {
    weekday: "short",
  });
}

function isoToDayNum(iso: string): number {
  return new Date(iso + "T00:00:00").getDate();
}

/** 0 = Sunday … 6 = Saturday → padded so Mon is first column. */
function dayOfWeekMondayFirst(iso: string): number {
  const dow = new Date(iso + "T00:00:00").getDay();
  return (dow + 6) % 7;
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekStart(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localIso(d);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return localIso(d);
}

function isoToYearMonth(iso: string): string {
  return iso.slice(0, 7);
}

function formatWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(weekStart + "T00:00:00");
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()} – ${end.getDate()} ${start.toLocaleDateString("en-SG", { month: "short", year: "numeric" })}`;
  }
  if (sameYear) {
    return `${start.getDate()} ${start.toLocaleDateString("en-SG", { month: "short" })} – ${end.getDate()} ${end.toLocaleDateString("en-SG", { month: "short", year: "numeric" })}`;
  }
  return `${start.getDate()} ${start.toLocaleDateString("en-SG", { month: "short", year: "numeric" })} – ${end.getDate()} ${end.toLocaleDateString("en-SG", { month: "short", year: "numeric" })}`;
}

// ─── session chip ────────────────────────────────────────────────────────────

function SessionChip({ session }: { session: CalendarSessionItem }) {
  const base =
    "rounded px-1.5 py-0.5 text-xs font-medium leading-tight truncate max-w-full";
  const color =
    session.status === "red"
      ? "bg-red-100 text-red-800 border border-red-300"
      : session.status === "blue"
        ? "bg-sky-100 text-sky-800 border border-sky-300"
        : session.status === "grey"
          ? "bg-zinc-400 text-white border border-zinc-500"
          : session.status === "inactive"
            ? "bg-zinc-100 text-zinc-400 border border-zinc-200"
            : "bg-orange-50 text-orange-900 border border-orange-200";

  return (
    <Link
      href={`/attendance/session/${session.sessionId}`}
      className={`${base} ${color} block hover:opacity-80`}
      title={`${session.classLabel} · ${session.timeLabel} · ${session.expectedCount} student${session.expectedCount === 1 ? "" : "s"}${session.status === "red" ? " · Relief needed" : ""}`}
    >
      {session.chipLabel}
      {session.status === "red" && (
        <span className="ml-1 text-red-500">⚑</span>
      )}
    </Link>
  );
}

function AdminShiftChip({ shift }: { shift: CalendarAdminShift }) {
  return (
    <div
      className="truncate rounded border border-violet-300 bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-900"
      title={`Admin: ${shift.staffName} ${shift.startTime}–${shift.endTime}`}
    >
      {shift.staffName} {shift.startTime}–{shift.endTime}
    </div>
  );
}

function coverageDayClass(status: DayCoverageStatus): string {
  if (status === "no_admin_no_class") return "bg-orange-50";
  if (status === "no_admin_has_class") return "bg-red-50";
  return "bg-white";
}

// ─── month grid ──────────────────────────────────────────────────────────────

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function MonthGrid({
  data,
  onWeekClick,
  showLessons,
  showAdmin,
}: {
  data: CalendarMonthData;
  onWeekClick: (weekStart: string) => void;
  showLessons: boolean;
  showAdmin: boolean;
}) {
  const today = localIso(new Date());
  const firstDay = data.days[0]?.date;
  const leadingBlanks = firstDay ? dayOfWeekMondayFirst(firstDay) : 0;

  const cells: Array<{ date: string | null; sessions: CalendarSessionItem[] }> = [
    ...Array(leadingBlanks).fill({ date: null, sessions: [] }),
    ...data.days,
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-px border-b border-zinc-200 bg-zinc-200">
        {DOW_LABELS.map((d) => (
          <div
            key={d}
            className="bg-white px-2 py-1 text-center text-xs font-medium text-zinc-500"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-zinc-200">
        {cells.map((cell, idx) => {
          if (!cell.date) {
            return <div key={`blank-${idx}`} className="min-h-24 bg-zinc-50" />;
          }
          const isToday = cell.date === today;
          const day = data.days.find((d) => d.date === cell.date);
          const coverage = day?.coverageStatus ?? "ok";
          const adminShifts = showAdmin ? (day?.adminShifts ?? []) : [];
          const sessions = showLessons ? cell.sessions : [];
          return (
            <div
              key={cell.date}
              className={`min-h-24 cursor-pointer p-1.5 hover:opacity-90 ${coverageDayClass(coverage)}`}
              onClick={() => onWeekClick(getWeekStart(cell.date!))}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={
                    isToday
                      ? "flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white"
                      : "text-xs font-medium text-zinc-600"
                  }
                >
                  {isoToDayNum(cell.date)}
                </span>
                {sessions.some((s) => s.status === "red") && (
                  <span className="text-xs text-red-500" title="Relief tutor needed">
                    ⚑
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {adminShifts.slice(0, 2).map((s) => (
                  <AdminShiftChip key={s.id} shift={s} />
                ))}
                {sessions.slice(0, 3).map((s) => (
                  <SessionChip key={s.sessionId} session={s} />
                ))}
                {(adminShifts.length + sessions.length) > 5 && (
                  <span className="text-xs text-zinc-400">+more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── week view ───────────────────────────────────────────────────────────────

function WeekView({
  weekStart,
  data,
  onBack,
  onPrevWeek,
  onNextWeek,
  showLessons,
  showAdmin,
}: {
  weekStart: string;
  data: CalendarMonthData;
  onBack: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  showLessons: boolean;
  showAdmin: boolean;
}) {
  const weekDays: string[] = [];
  const d = new Date(weekStart + "T00:00:00");
  for (let i = 0; i < 7; i++) {
    weekDays.push(localIso(d));
    d.setDate(d.getDate() + 1);
  }

  const dayMap = new Map(data.days.map((day) => [day.date, day]));
  const today = localIso(new Date());

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-orange-700 hover:underline"
        >
          ← Back to month
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevWeek}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            ←
          </button>
          <span className="min-w-48 text-center text-sm font-semibold text-zinc-800">
            {formatWeekLabel(weekStart)}
          </span>
          <button
            type="button"
            onClick={onNextWeek}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            →
          </button>
        </div>
        <div className="w-32" />
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-7 gap-2">
          {weekDays.map((iso) => {
            const day = dayMap.get(iso);
            const sessions = showLessons ? (day?.sessions ?? []) : [];
            const adminShifts = showAdmin ? (day?.adminShifts ?? []) : [];
            const isToday = iso === today;
            const hasRed = sessions.some((s) => s.status === "red");
            const cov = day?.coverageStatus ?? "ok";

            return (
              <div
                key={iso}
                className={`rounded-xl border p-2 ${
                  isToday
                    ? "border-orange-300 bg-orange-50"
                    : cov === "no_admin_has_class"
                      ? "border-red-300 bg-red-50"
                      : cov === "no_admin_no_class"
                        ? "border-orange-200 bg-orange-50"
                        : hasRed
                          ? "border-red-200 bg-red-50/30"
                          : "border-zinc-200 bg-white"
                }`}
              >
                <div className="mb-2 text-center">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {isoToDayOfWeek(iso)}
                  </div>
                  <div
                    className={`text-lg font-bold ${isToday ? "text-orange-600" : "text-zinc-800"}`}
                  >
                    {isoToDayNum(iso)}
                  </div>
                </div>

                {adminShifts.length === 0 && sessions.length === 0 ? (
                  <p className="text-center text-xs text-zinc-300">—</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {adminShifts.map((s) => (
                      <AdminShiftChip key={s.id} shift={s} />
                    ))}
                    {sessions.map((s) => (
                      <Link
                        key={s.sessionId}
                        href={`/attendance/session/${s.sessionId}`}
                        className={`rounded-lg border p-2 text-xs transition hover:opacity-80 ${
                          s.status === "red"
                            ? "border-red-300 bg-red-50 text-red-900"
                            : s.status === "blue"
                              ? "border-sky-300 bg-sky-50 text-sky-900"
                              : s.status === "grey"
                                ? "border-zinc-400 bg-zinc-300 text-zinc-700"
                                : s.status === "inactive"
                                  ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                                  : "border-orange-200 bg-orange-50/60 text-orange-900"
                        }`}
                      >
                        <div className="font-semibold leading-snug">
                          {s.typeLabel}
                          {s.status === "red" && (
                            <span className="ml-1 text-red-500">⚑</span>
                          )}
                        </div>
                        {s.tutor && (
                          <div className="mt-0.5 font-medium">{s.tutor}</div>
                        )}
                        <div className="mt-0.5 text-zinc-400">{s.timeLabel}</div>
                        <div className="mt-0.5">
                          {s.status === "inactive" ? (
                            <span className="text-zinc-400">No enrollments</span>
                          ) : s.status === "grey" ? (
                            <span>All waived/makeup</span>
                          ) : s.status === "red" ? (
                            <>
                              <span>{s.expectedCount} student{s.expectedCount === 1 ? "" : "s"}</span>
                              <div className="mt-0.5 font-medium text-red-700">Relief tutor needed</div>
                            </>
                          ) : (
                            <span>
                              {s.expectedCount} student{s.expectedCount === 1 ? "" : "s"}
                              {s.status === "blue" ? " (incl. trial)" : ""}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── legend ──────────────────────────────────────────────────────────────────

function ListView({
  data,
  showLessons,
  showAdmin,
}: {
  data: CalendarMonthData;
  showLessons: boolean;
  showAdmin: boolean;
}) {
  return (
    <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
      {data.days.map((day) => {
        const sessions = showLessons ? day.sessions : [];
        const admin = showAdmin ? day.adminShifts : [];
        if (sessions.length === 0 && admin.length === 0) return null;
        return (
          <li key={day.date} className={`px-4 py-3 ${coverageDayClass(day.coverageStatus)}`}>
            <p className="text-sm font-semibold text-zinc-800">
              {isoToDayOfWeek(day.date)} {isoToDayNum(day.date)}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {admin.map((s) => (
                <AdminShiftChip key={s.id} shift={s} />
              ))}
              {sessions.map((s) => (
                <SessionChip key={s.sessionId} session={s} />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-zinc-600">
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-violet-300 bg-violet-100" />
        Admin duty
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-orange-200 bg-orange-50" />
        No admin (no class)
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-red-200 bg-red-50" />
        No admin (has class)
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-orange-200 bg-orange-50" />
        Lesson
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-sky-300 bg-sky-100" />
        Trial student
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-red-300 bg-red-100" />
        Relief tutor needed
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-zinc-400 bg-zinc-400" />
        All waived/makeup
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-zinc-200 bg-zinc-100" />
        No enrollments
      </div>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function CalendarView() {
  const [yearMonth, setYearMonth] = useState(todayYearMonth);
  const [data, setData] = useState<CalendarMonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [hideInactive, setHideInactive] = useState(true);
  const [showLessons, setShowLessons] = useState(true);
  const [showAdmin, setShowAdmin] = useState(true);
  const [viewMode, setViewMode] = useState<"month" | "week" | "list">("month");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/calendar/${yearMonth}`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("Failed to load")),
      )
      .then((json: CalendarMonthData) => setData(json))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [yearMonth]);

  function navigateWeek(direction: -1 | 1) {
    if (!weekStart) return;
    const newWs = addDays(weekStart, direction * 7);
    setWeekStart(newWs);
    const newYm = isoToYearMonth(newWs);
    if (newYm !== yearMonth) setYearMonth(newYm);
  }

  const displayData =
    hideInactive && data
      ? {
          ...data,
          days: data.days.map((day) => ({
            ...day,
            sessions: day.sessions.filter((s) => s.status !== "inactive"),
          })),
        }
      : data;

  const redCount =
    displayData?.days.flatMap((d) => d.sessions).filter((s) => s.status === "red")
      .length ?? 0;
  const greyCount =
    displayData?.days.flatMap((d) => d.sessions).filter((s) => s.status === "grey")
      .length ?? 0;

  return (
    <div className="space-y-6">
      {/* Month nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setWeekStart(null); setYearMonth(prevMonth); }}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            ←
          </button>
          <h2 className="min-w-40 text-center text-lg font-semibold text-zinc-900">
            {formatMonthLabel(yearMonth)}
          </h2>
          <button
            type="button"
            onClick={() => { setWeekStart(null); setYearMonth(nextMonth); }}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => {
              const todayIso = localIso(new Date());
              const todayYm = todayYearMonth();
              if (weekStart !== null) {
                setWeekStart(getWeekStart(todayIso));
              } else {
                setWeekStart(null);
              }
              setYearMonth(todayYm);
            }}
            className="ml-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50"
          >
            Today
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Legend />
          {redCount > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
              {redCount} relief needed
            </span>
          )}
          {greyCount > 0 && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
              {greyCount} empty session{greyCount !== 1 ? "s" : ""}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowLessons((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              showLessons ? "border-orange-300 bg-orange-50 text-orange-800" : "border-zinc-200 text-zinc-500"
            }`}
          >
            Lessons
          </button>
          <button
            type="button"
            onClick={() => setShowAdmin((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              showAdmin ? "border-violet-300 bg-violet-50 text-violet-800" : "border-zinc-200 text-zinc-500"
            }`}
          >
            Admin roster
          </button>
          <button
            type="button"
            onClick={() => setHideInactive((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              hideInactive
                ? "border-zinc-300 bg-zinc-100 text-zinc-700"
                : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            {hideInactive ? "Active classes only" : "Show all classes"}
          </button>
          <div className="flex rounded-lg border border-zinc-200 p-0.5 text-xs">
            {(["month", "week", "list"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setViewMode(m);
                  if (m === "week" && !weekStart && data?.days[0]) {
                    setWeekStart(getWeekStart(data.days[0].date));
                  }
                  if (m === "month") setWeekStart(null);
                }}
                className={`rounded-md px-2.5 py-1 capitalize ${
                  viewMode === m ? "bg-zinc-800 text-white" : "text-zinc-600"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar content */}
      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-400">Loading…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : displayData ? (
        viewMode === "list" ? (
          <ListView data={displayData} showLessons={showLessons} showAdmin={showAdmin} />
        ) : viewMode === "week" && weekStart ? (
          <WeekView
            weekStart={weekStart}
            data={displayData}
            onBack={() => { setWeekStart(null); setViewMode("month"); }}
            onPrevWeek={() => navigateWeek(-1)}
            onNextWeek={() => navigateWeek(1)}
            showLessons={showLessons}
            showAdmin={showAdmin}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <MonthGrid
              data={displayData}
              onWeekClick={(ws) => { setWeekStart(ws); setViewMode("week"); }}
              showLessons={showLessons}
              showAdmin={showAdmin}
            />
          </div>
        )
      ) : null}
    </div>
  );
}
