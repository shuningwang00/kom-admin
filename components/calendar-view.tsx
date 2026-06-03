"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminRosterDayPanel from "@/components/calendar/admin-roster-day-panel";
import type {
  CalendarAdminShift,
  CalendarEventItem,
  CalendarHolSessionItem,
  CalendarMonthData,
  CalendarSessionItem,
  DayCoverageStatus,
} from "@/lib/calendar/month-data";
import {
  calendarReliefLegendSwatchClass,
  calendarSessionCardClass,
  calendarSessionChipClass,
} from "@/lib/calendar/session-styles";
import { isReliefTutorNeeded } from "@/lib/tutors/constants";
import { sessionTutorDisplay } from "@/lib/tutors/display";
import type { RosterAvailSlot, RosterStaffPick } from "@/lib/people/roster-scheduling";
import type { StaffTimeOffRecord } from "@/lib/people/staff-time-off";

type CalendarApiData = CalendarMonthData & {
  canManageRoster?: boolean;
  canAddEvents?: boolean;
  scopedToOwnClasses?: boolean;
};

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

function fmt12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h)) return hhmm;
  const hour = h % 12 || 12;
  const mer = h >= 12 ? "pm" : "am";
  return m ? `${hour}:${String(m).padStart(2, "0")}${mer}` : `${hour}${mer}`;
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

function SessionChip({ session, showTime = false }: { session: CalendarSessionItem; showTime?: boolean }) {
  const base =
    "rounded px-1.5 py-0.5 text-xs font-medium leading-tight truncate max-w-full";

  const title = [
    `${session.classLabel} · ${session.timeLabel} · ${session.expectedCount} student${session.expectedCount === 1 ? "" : "s"}`,
    session.status === "cancelled" ? "Class cancelled" : session.status === "red" ? "Relief needed" : session.status === "relief" ? "Relief cover" : "",
    session.rescheduleNote && session.sessionStatus !== "cancelled" ? `Rescheduled: ${session.rescheduleNote}` : "",
  ].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/attendance/session/${session.sessionId}`}
      className={`${base} ${calendarSessionChipClass(session.status)} block hover:opacity-80`}
      title={title}
    >
      {session.rescheduleNote && session.sessionStatus !== "cancelled" && (
        <span className="mr-1 opacity-70">↺</span>
      )}
      {session.chipLabel}
      {session.status === "red" && (
        <span className="ml-1 text-red-500">⚑</span>
      )}
      {showTime && session.timeLabel && (
        <span className="ml-1.5 font-normal opacity-70">{session.timeLabel}</span>
      )}
    </Link>
  );
}

function HolSessionChip({ session, showTime = false }: { session: CalendarHolSessionItem; showTime?: boolean }) {
  const base =
    "rounded px-1.5 py-0.5 text-xs font-medium leading-tight truncate max-w-full";
  const label = session.tutorName
    ? `${session.programmeName} · ${session.tutorName}`
    : session.programmeName;
  return (
    <Link
      href={`/attendance/hol-session/${session.sessionId}`}
      className={`${base} bg-emerald-50 text-emerald-900 border border-emerald-300 block hover:opacity-80`}
      title={`${session.programmeName}${session.tutorName ? ` · ${session.tutorName}` : ""}${session.timeLabel ? ` · ${session.timeLabel}` : ""}`}
    >
      {label}
      {showTime && session.timeLabel && (
        <span className="ml-1.5 font-normal opacity-70">
          {session.timeLabel.replace(/(\d{2}):(\d{2})/g, (_, h, m) => fmt12h(`${h}:${m}`))}
        </span>
      )}
    </Link>
  );
}

function AdminShiftChip({ shift }: { shift: CalendarAdminShift }) {
  const draft = !shift.published;
  return (
    <div
      className={`truncate rounded border px-1.5 py-0.5 text-xs font-medium ${
        draft
          ? "border-dashed border-amber-300 bg-amber-50 text-amber-900"
          : "border-violet-300 bg-violet-100 text-violet-900"
      }`}
      title={`Admin: ${shift.staffName} ${fmt12h(shift.startTime)}–${fmt12h(shift.endTime)}${draft ? " (draft)" : ""}`}
    >
      {shift.staffName} {fmt12h(shift.startTime)}–{fmt12h(shift.endTime)}
    </div>
  );
}

function EventChip({
  event,
  onEdit,
  canEdit,
}: {
  event: CalendarEventItem;
  onEdit?: (e: CalendarEventItem) => void;
  canEdit?: boolean;
}) {
  const timeStr = event.startTime
    ? event.endTime
      ? `${fmt12h(event.startTime)}–${fmt12h(event.endTime)}`
      : fmt12h(event.startTime)
    : "";
  return (
    <div
      className={`truncate rounded border border-pink-300 bg-pink-50 px-1.5 py-0.5 text-xs font-medium text-pink-900 ${canEdit ? "cursor-pointer hover:bg-pink-100" : ""}`}
      title={`${event.title}${timeStr ? ` · ${timeStr}` : ""}${event.notes ? ` · ${event.notes}` : ""}`}
      onClick={() => canEdit && onEdit?.(event)}
    >
      {event.title}
      {timeStr && <span className="ml-1 font-normal opacity-70">{timeStr}</span>}
    </div>
  );
}

function EventCard({
  event,
  onEdit,
  canEdit,
}: {
  event: CalendarEventItem;
  onEdit?: (e: CalendarEventItem) => void;
  canEdit?: boolean;
}) {
  const timeStr = event.startTime
    ? event.endTime
      ? `${fmt12h(event.startTime)}–${fmt12h(event.endTime)}`
      : fmt12h(event.startTime)
    : "";
  return (
    <div
      className={`rounded-lg border border-pink-300 bg-pink-50 p-2 text-xs text-pink-900 ${canEdit ? "cursor-pointer hover:bg-pink-100" : ""}`}
      onClick={() => canEdit && onEdit?.(event)}
    >
      <div className="font-semibold leading-snug">{event.title}</div>
      {timeStr && <div className="mt-0.5 text-pink-700">{timeStr}</div>}
      {event.notes && <div className="mt-0.5 text-pink-800 opacity-80">{event.notes}</div>}
    </div>
  );
}

function coverageDayClass(status: DayCoverageStatus): string {
  if (status === "no_admin_no_class") return "bg-orange-50";
  if (status === "no_admin_has_class") return "bg-red-50";
  return "bg-white";
}

const MAX_ADMINS_WITH_LESSONS = 2;
const MAX_LESSONS_IN_MONTH_CELL = 3;
/** When lessons are hidden, show more admin chips in the day cell. */
const MAX_ADMINS_ADMIN_ONLY = 8;

function monthCellPreview(
  adminShifts: CalendarAdminShift[],
  sessions: CalendarSessionItem[],
  holSessions: CalendarHolSessionItem[],
  lessonsVisible: boolean,
) {
  if (!lessonsVisible) {
    const shownAdmins = adminShifts.slice(0, MAX_ADMINS_ADMIN_ONLY);
    return {
      shownAdmins,
      shownSessions: [] as CalendarSessionItem[],
      shownHolSessions: [] as CalendarHolSessionItem[],
      hiddenAdmins: adminShifts.length - shownAdmins.length,
      hiddenLessons: 0,
    };
  }

  const shownAdmins = adminShifts.slice(0, MAX_ADMINS_WITH_LESSONS);
  const shownSessions = sessions.slice(0, MAX_LESSONS_IN_MONTH_CELL);
  const holSlots = Math.max(0, MAX_LESSONS_IN_MONTH_CELL - shownSessions.length);
  const shownHolSessions = holSessions.slice(0, holSlots);
  const hiddenLessons =
    sessions.length - shownSessions.length +
    holSessions.length - shownHolSessions.length;
  return {
    shownAdmins,
    shownSessions,
    shownHolSessions,
    hiddenAdmins: adminShifts.length - shownAdmins.length,
    hiddenLessons,
  };
}

// ─── month grid ──────────────────────────────────────────────────────────────

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function MonthGrid({
  data,
  onWeekClick,
  onDaySelect,
  canManageRoster,
  canAddEvents,
  selectedDate,
  showLessons,
  showAdmin,
  onEditEvent,
}: {
  data: CalendarMonthData;
  onWeekClick: (weekStart: string) => void;
  onDaySelect: (date: string) => void;
  canManageRoster: boolean;
  canAddEvents: boolean;
  selectedDate: string | null;
  showLessons: boolean;
  showAdmin: boolean;
  onEditEvent?: (e: CalendarEventItem) => void;
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
          const holSessions = showLessons ? (day?.holSessions ?? []) : [];
          const dayEvents = day?.events ?? [];
          const preview = monthCellPreview(adminShifts, sessions, holSessions, showLessons);
          const isSelected = selectedDate === cell.date;
          return (
            <div
              key={cell.date}
              role={canManageRoster ? "button" : undefined}
              tabIndex={canManageRoster ? 0 : undefined}
              className={`min-h-24 p-1.5 ${
                canManageRoster ? "cursor-pointer hover:ring-2 hover:ring-inset hover:ring-violet-300" : "cursor-pointer hover:opacity-90"
              } ${coverageDayClass(coverage)} ${
                isSelected ? "ring-2 ring-inset ring-violet-500" : ""
              }`}
              onClick={() => {
                if (canManageRoster) {
                  onDaySelect(cell.date!);
                  return;
                }
                onWeekClick(getWeekStart(cell.date!));
              }}
              onKeyDown={(e) => {
                if (!canManageRoster) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDaySelect(cell.date!);
                }
              }}
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
              <div
                className="flex flex-col gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                {dayEvents.map((ev) => (
                  <EventChip key={ev.id} event={ev} canEdit={canAddEvents} onEdit={onEditEvent} />
                ))}
                {preview.shownAdmins.map((s) => (
                  <AdminShiftChip key={s.id} shift={s} />
                ))}
                {preview.shownSessions.map((s) => (
                  <SessionChip key={s.sessionId} session={s} />
                ))}
                {preview.shownHolSessions.map((s) => (
                  <HolSessionChip key={s.sessionId} session={s} />
                ))}
                {preview.hiddenAdmins > 0 && (
                  <span
                    className="text-xs font-medium text-violet-700"
                    title={`${preview.hiddenAdmins} more admin shift${preview.hiddenAdmins === 1 ? "" : "s"}`}
                  >
                    +{preview.hiddenAdmins} admin
                  </span>
                )}
                {preview.hiddenLessons > 0 && (
                  <span
                    className="text-xs text-zinc-500"
                    title={`${preview.hiddenLessons} more lesson${preview.hiddenLessons === 1 ? "" : "s"}`}
                  >
                    +{preview.hiddenLessons} lesson
                    {preview.hiddenLessons === 1 ? "" : "s"}
                  </span>
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
  onDaySelect,
  canManageRoster,
  canAddEvents,
  selectedDate,
  showLessons,
  showAdmin,
  onEditEvent,
}: {
  weekStart: string;
  data: CalendarMonthData;
  onBack: () => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onDaySelect: (date: string) => void;
  canManageRoster: boolean;
  canAddEvents: boolean;
  selectedDate: string | null;
  showLessons: boolean;
  showAdmin: boolean;
  onEditEvent?: (e: CalendarEventItem) => void;
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
            const holSessions = showLessons ? (day?.holSessions ?? []) : [];
            const adminShifts = showAdmin ? (day?.adminShifts ?? []) : [];
            const dayEvents = day?.events ?? [];
            const isToday = iso === today;
            const hasRed = sessions.some((s) => s.status === "red");
            const cov = day?.coverageStatus ?? "ok";

            const isSelected = selectedDate === iso;
            return (
              <div
                key={iso}
                role={canManageRoster ? "button" : undefined}
                tabIndex={canManageRoster ? 0 : undefined}
                onClick={() => {
                  if (canManageRoster) onDaySelect(iso);
                }}
                onKeyDown={(e) => {
                  if (!canManageRoster) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onDaySelect(iso);
                  }
                }}
                className={`rounded-xl border p-2 ${
                  canManageRoster ? "cursor-pointer hover:ring-2 hover:ring-violet-300" : ""
                } ${
                  isSelected
                    ? "ring-2 ring-violet-500"
                    : isToday
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

                {adminShifts.length === 0 && sessions.length === 0 && holSessions.length === 0 && dayEvents.length === 0 ? (
                  <p className="text-center text-xs text-zinc-300">—</p>
                ) : (
                  <div
                    className="flex flex-col gap-1.5"
                    onClick={(e) => canManageRoster && e.stopPropagation()}
                  >
                    {dayEvents.map((ev) => (
                      <EventCard key={ev.id} event={ev} canEdit={canAddEvents} onEdit={onEditEvent} />
                    ))}
                    {adminShifts.map((s) => (
                      <AdminShiftChip key={s.id} shift={s} />
                    ))}
                    {sessions.map((s) => (
                      <Link
                        key={s.sessionId}
                        href={`/attendance/session/${s.sessionId}`}
                        className={`rounded-lg border p-2 text-xs transition hover:opacity-80 ${calendarSessionCardClass(s.status)}`}
                      >
                        <div className="font-semibold leading-snug">
                          {s.typeLabel}
                          {s.status === "red" && (
                            <span className="ml-1 text-red-500">⚑</span>
                          )}
                        </div>
                        {(() => {
                          const { primary, subtitle } = sessionTutorDisplay(
                            s.tutor,
                            s.reliefTutor ?? "",
                          );
                          if (!primary || primary === "—") return null;
                          return (
                            <>
                              <div className="mt-0.5 font-medium">{primary}</div>
                              {subtitle && (
                                <div className="mt-0.5 text-[10px] text-zinc-500">
                                  {subtitle}
                                </div>
                              )}
                            </>
                          );
                        })()}
                        <div className="mt-0.5 text-zinc-400">{s.timeLabel}</div>
                        {s.rescheduleNote && s.sessionStatus !== "cancelled" && (
                          <div className="mt-0.5 text-[10px] font-medium text-amber-800">
                            ↺ {s.rescheduleNote}
                          </div>
                        )}
                        <div className="mt-0.5">
                          {s.status === "inactive" ? (
                            <span className="text-zinc-400">No enrollments</span>
                          ) : s.status === "grey" ? (
                            <span>All waived/makeup</span>
                          ) : s.status === "red" &&
                            isReliefTutorNeeded(s.reliefTutor ?? "") ? (
                            <>
                              <span>{s.expectedCount} student{s.expectedCount === 1 ? "" : "s"}</span>
                              <div className="mt-0.5 font-medium text-red-700">Relief tutor needed</div>
                            </>
                          ) : s.status === "red" ? (
                            <span>
                              {s.expectedCount} student{s.expectedCount === 1 ? "" : "s"}
                            </span>
                          ) : (
                            <span>
                              {s.expectedCount} student{s.expectedCount === 1 ? "" : "s"}
                              {s.status === "blue" ? " (incl. trial)" : ""}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                    {holSessions.map((s) => (
                      <Link
                        key={s.sessionId}
                        href={`/attendance/hol-session/${s.sessionId}`}
                        className="rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-900 transition hover:opacity-80"
                      >
                        <div className="font-semibold leading-snug">{s.programmeName}</div>
                        {s.tutorName && (
                          <div className="mt-0.5 font-medium">{s.tutorName}</div>
                        )}
                        {s.timeLabel && (
                          <div className="mt-0.5 text-emerald-600">{s.timeLabel}</div>
                        )}
                        <div className="mt-0.5 text-emerald-700">
                          {s.newCount} new + {s.existingCount} existing
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
  canManageRoster,
  canAddEvents,
  onDaySelect,
  onEditEvent,
}: {
  data: CalendarMonthData;
  showLessons: boolean;
  showAdmin: boolean;
  canManageRoster: boolean;
  canAddEvents: boolean;
  onDaySelect: (date: string) => void;
  onEditEvent?: (e: CalendarEventItem) => void;
}) {
  return (
    <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
      {data.days.map((day) => {
        const sessions = showLessons ? day.sessions : [];
        const holSessions = showLessons ? day.holSessions : [];
        const admin = showAdmin ? day.adminShifts : [];
        const dayEvents = day.events ?? [];
        if (sessions.length === 0 && holSessions.length === 0 && admin.length === 0 && dayEvents.length === 0) return null;
        return (
          <li
            key={day.date}
            className={`px-4 py-3 ${coverageDayClass(day.coverageStatus)} ${
              canManageRoster ? "cursor-pointer hover:bg-violet-50/40" : ""
            }`}
            onClick={() => {
              if (canManageRoster) onDaySelect(day.date);
            }}
          >
            <p className="text-sm font-semibold text-zinc-800">
              {isoToDayOfWeek(day.date)} {isoToDayNum(day.date)}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {dayEvents.map((ev) => (
                <EventChip key={ev.id} event={ev} canEdit={canAddEvents} onEdit={onEditEvent} />
              ))}
              {admin.map((s) => (
                <AdminShiftChip key={s.id} shift={s} />
              ))}
              {sessions.map((s) => (
                <SessionChip key={s.sessionId} session={s} showTime />
              ))}
              {holSessions.map((s) => (
                <HolSessionChip key={s.sessionId} session={s} showTime />
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
        <span className="h-3 w-3 rounded border border-pink-300 bg-pink-50" />
        Event / notice
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-violet-300 bg-violet-100" />
        Admin duty
      </div>
      <div className="flex items-center gap-1.5">
        <span className={calendarReliefLegendSwatchClass} />
        Relief cover
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-zinc-400 bg-zinc-200" />
        Class cancelled
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-amber-800">↺</span>
        Rescheduled
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

const EMPTY_EVENT_FORM = { title: "", eventDate: "", startTime: "", endTime: "", notes: "" };

export default function CalendarView() {
  const [yearMonth, setYearMonth] = useState(todayYearMonth);
  const [data, setData] = useState<CalendarMonthData | null>(null);
  const [canManageRoster, setCanManageRoster] = useState(false);
  const [canAddEvents, setCanAddEvents] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState(EMPTY_EVENT_FORM);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventError, setEventError] = useState("");
  const [rosterStaff, setRosterStaff] = useState<RosterStaffPick[]>([]);
  const [rosterAvailability, setRosterAvailability] = useState<RosterAvailSlot[]>(
    [],
  );
  const [rosterTimeOff, setRosterTimeOff] = useState<StaffTimeOffRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [rosterSaving, setRosterSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [hideInactive, setHideInactive] = useState(true);
  const [showLessons, setShowLessons] = useState(true);
  const [scopedToOwnClasses, setScopedToOwnClasses] = useState(false);
  const [showAdmin, setShowAdmin] = useState(true);
  const [viewMode, setViewMode] = useState<"month" | "week" | "list">(
    isMobile ? "list" : "month",
  );

  const loadCalendar = useCallback(async (ym: string) => {
    const res = await fetch(`/api/calendar/${ym}`);
    const json = (await res.json()) as CalendarApiData & { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Failed to load");
    setData(json);
    setCanManageRoster(Boolean(json.canManageRoster));
    setCanAddEvents(Boolean(json.canAddEvents));
    setScopedToOwnClasses(Boolean(json.scopedToOwnClasses));
    if (json.scopedToOwnClasses) setShowAdmin(false);
    return json;
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadCalendar(yearMonth)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [yearMonth, loadCalendar]);

  const loadRosterContext = useCallback(async (ym: string) => {
    const res = await fetch(`/api/admin-roster?month=${ym}`);
    if (!res.ok) {
      setRosterStaff([]);
      setRosterAvailability([]);
      setRosterTimeOff([]);
      return;
    }
    const json = (await res.json()) as {
      staff?: RosterStaffPick[];
      availability?: RosterAvailSlot[];
      staffTimeOff?: StaffTimeOffRecord[];
    };
    setRosterStaff(json.staff ?? []);
    setRosterAvailability(json.availability ?? []);
    setRosterTimeOff(json.staffTimeOff ?? []);
  }, []);

  useEffect(() => {
    if (!canManageRoster) {
      setRosterStaff([]);
      setRosterAvailability([]);
      setRosterTimeOff([]);
      return;
    }
    loadRosterContext(yearMonth).catch(() => {
      setRosterStaff([]);
      setRosterAvailability([]);
      setRosterTimeOff([]);
    });
  }, [canManageRoster, yearMonth, loadRosterContext]);

  async function refreshAfterRosterChange() {
    await Promise.all([loadCalendar(yearMonth), loadRosterContext(yearMonth)]);
  }

  async function handleAddRosterShift(
    input: { staffEmail: string; startTime: string; endTime: string },
  ) {
    if (!selectedDate) return;
    setRosterSaving(true);
    try {
      const res = await fetch("/api/admin-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftDate: selectedDate,
          staffEmail: input.staffEmail,
          startTime: input.startTime,
          endTime: input.endTime,
          published: true,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await refreshAfterRosterChange();
    } finally {
      setRosterSaving(false);
    }
  }

  async function handleUpdateRosterShift(input: {
    id: string;
    staffEmail: string;
    startTime: string;
    endTime: string;
  }) {
    if (!selectedDate) return;
    setRosterSaving(true);
    try {
      const res = await fetch(`/api/admin-roster/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftDate: selectedDate,
          staffEmail: input.staffEmail,
          startTime: input.startTime,
          endTime: input.endTime,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await refreshAfterRosterChange();
    } finally {
      setRosterSaving(false);
    }
  }

  async function handleRemoveRosterShift(id: string) {
    setRosterSaving(true);
    try {
      const res = await fetch(`/api/admin-roster/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Failed");
      }
      await refreshAfterRosterChange();
    } finally {
      setRosterSaving(false);
    }
  }

  function openNewEventForm(date?: string) {
    setEditingEvent(null);
    const today = localIso(new Date());
    setEventForm({ ...EMPTY_EVENT_FORM, eventDate: date ?? today });
    setEventError("");
    setShowEventForm(true);
  }

  function openEditEvent(ev: CalendarEventItem) {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title,
      eventDate: ev.eventDate,
      startTime: ev.startTime,
      endTime: ev.endTime,
      notes: ev.notes,
    });
    setEventError("");
    setShowEventForm(true);
  }

  async function saveEvent() {
    const { title, eventDate, startTime, endTime, notes } = eventForm;
    if (!title.trim() || !eventDate) { setEventError("Title and date are required."); return; }
    setEventSaving(true);
    setEventError("");
    try {
      const url = editingEvent ? `/api/calendar-events/${editingEvent.id}` : "/api/calendar-events";
      const method = editingEvent ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), eventDate, startTime, endTime, notes }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setEventError(d.error ?? "Failed to save");
        return;
      }
      setShowEventForm(false);
      setEditingEvent(null);
      await loadCalendar(yearMonth);
    } finally {
      setEventSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    setEventSaving(true);
    try {
      await fetch(`/api/calendar-events/${id}`, { method: "DELETE" });
      setShowEventForm(false);
      setEditingEvent(null);
      await loadCalendar(yearMonth);
    } finally {
      setEventSaving(false);
    }
  }

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

  const selectedDay = selectedDate
    ? displayData?.days.find((d) => d.date === selectedDate)
    : null;

  return (
    <div className="space-y-6">
      {scopedToOwnClasses && (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Showing only classes you teach or cover as relief.
        </p>
      )}

      {canManageRoster && (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
          Click any day to schedule admin duty alongside lessons. Only you see
          this — everyone else sees the published calendar.
        </p>
      )}

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

        <div className="flex flex-wrap items-center gap-2">
          {canAddEvents && (
            <button
              type="button"
              onClick={() => openNewEventForm()}
              className="rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pink-700"
            >
              + Add event
            </button>
          )}
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
          <button
            type="button"
            onClick={() => setShowLessons((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              showLessons ? "border-orange-300 bg-orange-50 text-orange-800" : "border-zinc-200 text-zinc-500"
            }`}
          >
            Lessons
          </button>
          {!scopedToOwnClasses && (
            <button
              type="button"
              onClick={() => setShowAdmin((v) => !v)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                showAdmin ? "border-violet-300 bg-violet-50 text-violet-800" : "border-zinc-200 text-zinc-500"
              }`}
            >
              Admin
            </button>
          )}
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
        </div>
      </div>

      {/* Event form */}
      {showEventForm && (
        <div className="rounded-xl border border-pink-200 bg-pink-50 p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-pink-900">
            {editingEvent ? "Edit event" : "Add event"}
          </h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-pink-800">Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Team meeting, Printer servicing, Delivery"
                value={eventForm.title}
                onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-pink-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-pink-800">Date</label>
              <input
                type="date"
                required
                value={eventForm.eventDate}
                onChange={(e) => setEventForm((f) => ({ ...f, eventDate: e.target.value }))}
                className="mt-1 rounded-lg border border-pink-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-pink-800">Start time <span className="font-normal opacity-60">(optional)</span></label>
              <input
                type="time"
                value={eventForm.startTime}
                onChange={(e) => setEventForm((f) => ({ ...f, startTime: e.target.value }))}
                className="mt-1 rounded-lg border border-pink-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-pink-800">End time <span className="font-normal opacity-60">(optional)</span></label>
              <input
                type="time"
                value={eventForm.endTime}
                onChange={(e) => setEventForm((f) => ({ ...f, endTime: e.target.value }))}
                className="mt-1 rounded-lg border border-pink-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-pink-800">Notes <span className="font-normal opacity-60">(optional)</span></label>
              <input
                type="text"
                placeholder="Extra details"
                value={eventForm.notes}
                onChange={(e) => setEventForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-pink-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>
          </div>
          {eventError && <p className="mt-2 text-xs text-red-600">{eventError}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={eventSaving}
              onClick={saveEvent}
              className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50"
            >
              {eventSaving ? "Saving…" : editingEvent ? "Save changes" : "Add event"}
            </button>
            {editingEvent && (
              <button
                type="button"
                disabled={eventSaving}
                onClick={() => deleteEvent(editingEvent.id)}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => { setShowEventForm(false); setEditingEvent(null); }}
              className="text-sm text-zinc-500 hover:text-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Calendar content */}
      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-400">Loading…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : displayData ? (
        viewMode === "list" ? (
          <ListView
            data={displayData}
            showLessons={showLessons}
            showAdmin={showAdmin}
            canManageRoster={canManageRoster}
            canAddEvents={canAddEvents}
            onDaySelect={setSelectedDate}
            onEditEvent={openEditEvent}
          />
        ) : viewMode === "week" && weekStart ? (
          <WeekView
            weekStart={weekStart}
            data={displayData}
            onBack={() => { setWeekStart(null); setViewMode("month"); }}
            onPrevWeek={() => navigateWeek(-1)}
            onNextWeek={() => navigateWeek(1)}
            onDaySelect={setSelectedDate}
            canManageRoster={canManageRoster}
            canAddEvents={canAddEvents}
            selectedDate={selectedDate}
            showLessons={showLessons}
            showAdmin={showAdmin}
            onEditEvent={openEditEvent}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <MonthGrid
              data={displayData}
              onWeekClick={(ws) => { setWeekStart(ws); setViewMode("week"); }}
              onDaySelect={setSelectedDate}
              canManageRoster={canManageRoster}
              canAddEvents={canAddEvents}
              selectedDate={selectedDate}
              showLessons={showLessons}
              showAdmin={showAdmin}
              onEditEvent={openEditEvent}
            />
          </div>
        )
      ) : null}

      {canManageRoster && selectedDate && selectedDay && (
        <AdminRosterDayPanel
          date={selectedDate}
          yearMonth={yearMonth}
          sessions={selectedDay.sessions}
          holSessions={selectedDay.holSessions}
          adminShifts={selectedDay.adminShifts}
          staff={rosterStaff}
          availability={rosterAvailability}
          staffTimeOff={rosterTimeOff}
          saving={rosterSaving}
          onClose={() => setSelectedDate(null)}
          onAddShift={handleAddRosterShift}
          onUpdateShift={handleUpdateRosterShift}
          onRemoveShift={handleRemoveRosterShift}
          onViewWeek={() => {
            setWeekStart(getWeekStart(selectedDate));
            setViewMode("week");
          }}
        />
      )}
    </div>
  );
}
