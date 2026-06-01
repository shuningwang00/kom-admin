"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  CalendarAdminShift,
  CalendarHolSessionItem,
  CalendarSessionItem,
} from "@/lib/calendar/month-data";
import { calendarSessionCardClass } from "@/lib/calendar/session-styles";
import { isReliefTutorNeeded } from "@/lib/tutors/constants";
import { sessionTutorDisplay } from "@/lib/tutors/display";
import {
  buildRosterStaffOptions,
  defaultRosterStaffEmail,
  type RosterAvailSlot,
  type RosterStaffOption,
  type RosterStaffPick,
} from "@/lib/people/roster-scheduling";
import type { StaffTimeOffRecord } from "@/lib/people/staff-time-off";
import { defaultRosterShiftTimes } from "@/lib/centre-hours";

function formatDayHeading(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function statusLabel(status: RosterStaffOption["status"]): string {
  if (status === "covers_shift") return "Covers this shift";
  if (status === "available_day") return "Available (partial)";
  if (status === "time_off") return "Time off";
  return "No availability";
}

function statusBadgeClass(status: RosterStaffOption["status"]): string {
  if (status === "covers_shift") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (status === "available_day") {
    return "border-sky-300 bg-sky-50 text-sky-900";
  }
  if (status === "time_off") {
    return "border-zinc-200 bg-zinc-100 text-zinc-500";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function StaffPickRow({
  option,
  selected,
  disabled,
  onSelect,
}: {
  option: RosterStaffOption;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const slotsText = option.slots
    .map((s) => `${s.startTime}–${s.endTime}${s.label ? ` (${s.label})` : ""}`)
    .join(", ");

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
        selected
          ? "border-violet-500 bg-violet-50 ring-1 ring-violet-400"
          : statusBadgeClass(option.status)
      } ${disabled ? "cursor-not-allowed opacity-50" : "hover:opacity-90"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{option.displayName}</span>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide opacity-80">
          {statusLabel(option.status)}
        </span>
      </div>
      {slotsText && (
        <p className="mt-0.5 text-xs opacity-80">{slotsText}</p>
      )}
      {option.alreadyScheduled && (
        <p className="mt-0.5 text-xs font-medium text-violet-700">
          Already on admin roster this day
        </p>
      )}
    </button>
  );
}

export default function AdminRosterDayPanel({
  date,
  yearMonth,
  sessions,
  holSessions,
  adminShifts,
  staff,
  availability,
  staffTimeOff,
  saving,
  onClose,
  onAddShift,
  onUpdateShift,
  onRemoveShift,
  onViewWeek,
}: {
  date: string;
  yearMonth: string;
  sessions: CalendarSessionItem[];
  holSessions: CalendarHolSessionItem[];
  adminShifts: CalendarAdminShift[];
  staff: RosterStaffPick[];
  availability: RosterAvailSlot[];
  staffTimeOff: StaffTimeOffRecord[];
  saving: boolean;
  onClose: () => void;
  onAddShift: (input: {
    staffEmail: string;
    startTime: string;
    endTime: string;
  }) => Promise<void>;
  onUpdateShift: (input: {
    id: string;
    staffEmail: string;
    startTime: string;
    endTime: string;
  }) => Promise<void>;
  onRemoveShift: (id: string) => Promise<void>;
  onViewWeek: () => void;
}) {
  const defaultTimes = defaultRosterShiftTimes(date);
  const [startTime, setStartTime] = useState(defaultTimes.startTime);
  const [endTime, setEndTime] = useState(defaultTimes.endTime);
  const [staffEmail, setStaffEmail] = useState("");
  const [editingShift, setEditingShift] = useState<CalendarAdminShift | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const scheduledEmails = useMemo(
    () =>
      adminShifts
        .filter((s) => s.id !== editingShift?.id)
        .map((s) => s.staffEmail),
    [adminShifts, editingShift],
  );

  const staffOptions = useMemo(
    () =>
      buildRosterStaffOptions(
        staff,
        availability,
        staffTimeOff,
        yearMonth,
        date,
        { startTime, endTime },
        scheduledEmails,
      ),
    [
      staff,
      availability,
      staffTimeOff,
      yearMonth,
      date,
      startTime,
      endTime,
      scheduledEmails,
    ],
  );

  const availableToPick = staffOptions.filter(
    (o) => o.status !== "time_off" && o.status !== "no_submission",
  );
  const recommended = staffOptions.filter((o) => o.status === "covers_shift");
  const partial = staffOptions.filter((o) => o.status === "available_day");
  const unavailable = staffOptions.filter(
    (o) => o.status === "time_off" || o.status === "no_submission",
  );

  function resetAddFormTimes() {
    const t = defaultRosterShiftTimes(date);
    setStartTime(t.startTime);
    setEndTime(t.endTime);
  }

  useEffect(() => {
    if (!editingShift) resetAddFormTimes();
  }, [date, editingShift]);

  useEffect(() => {
    if (editingShift) {
      setStaffEmail(editingShift.staffEmail);
      setStartTime(editingShift.startTime);
      setEndTime(editingShift.endTime);
    }
  }, [editingShift]);

  useEffect(() => {
    if (editingShift) return;
    const next = defaultRosterStaffEmail(staffOptions);
    setStaffEmail((prev) => {
      if (prev && staffOptions.some((o) => o.email === prev)) return prev;
      return next;
    });
  }, [staffOptions, editingShift]);

  function startEdit(shift: CalendarAdminShift) {
    setEditingShift(shift);
    setError(null);
  }

  function cancelEdit() {
    setEditingShift(null);
    setError(null);
    resetAddFormTimes();
    const next = defaultRosterStaffEmail(staffOptions);
    setStaffEmail(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!staffEmail) {
      setError("Select an available staff member.");
      return;
    }
    const picked = staffOptions.find((o) => o.email === staffEmail);
    if (picked?.status === "time_off" || picked?.status === "no_submission") {
      setError("This person is not available for this day.");
      return;
    }
    setError(null);
    try {
      if (editingShift) {
        await onUpdateShift({
          id: editingShift.id,
          staffEmail,
          startTime,
          endTime,
        });
        setEditingShift(null);
        resetAddFormTimes();
        setStaffEmail(defaultRosterStaffEmail(staffOptions));
      } else {
        await onAddShift({ staffEmail, startTime, endTime });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
              Schedule admin duty
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-zinc-900">
              {formatDayHeading(date)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <section>
            <h3 className="text-sm font-semibold text-violet-900">Admin on duty</h3>
            {adminShifts.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-400">No admin shift yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {adminShifts.map((s) => (
                  <li
                    key={s.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                      s.published
                        ? "border-violet-300 bg-violet-50 text-violet-900"
                        : "border-amber-300 bg-amber-50 text-amber-900"
                    }`}
                  >
                    <span>
                      <span className="font-medium">{s.staffName}</span>
                      <span className="text-zinc-600">
                        {" "}
                        · {s.startTime}–{s.endTime}
                      </span>
                      {!s.published && (
                        <span className="ml-1.5 text-xs font-medium">draft</span>
                      )}
                    </span>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => startEdit(s)}
                        className="text-xs text-violet-700 hover:underline disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          if (editingShift?.id === s.id) cancelEdit();
                          onRemoveShift(s.id);
                        }}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <p className="mt-2 text-sm text-red-700">{error}</p>
            )}
            <form
              onSubmit={handleSubmit}
              className="mt-4 space-y-3 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3"
            >
              <p className="text-xs font-medium text-zinc-600">
                {editingShift ? "Edit shift" : "Add shift"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-zinc-500">Start</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500">End</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-600">
                  Available staff
                  <span className="font-normal text-zinc-400">
                    {" "}
                    (from submitted availability, minus time off)
                  </span>
                </p>
                {availableToPick.length === 0 ? (
                  <p className="mt-2 text-sm text-amber-800">
                    No one is marked available for this day. Check People →
                    Availability or pick times that match a submitted slot.
                  </p>
                ) : (
                  <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                    {recommended.map((o) => (
                      <StaffPickRow
                        key={o.email}
                        option={o}
                        selected={staffEmail === o.email}
                        disabled={saving}
                        onSelect={() => setStaffEmail(o.email)}
                      />
                    ))}
                    {partial.map((o) => (
                      <StaffPickRow
                        key={o.email}
                        option={o}
                        selected={staffEmail === o.email}
                        disabled={saving}
                        onSelect={() => setStaffEmail(o.email)}
                      />
                    ))}
                  </div>
                )}
                {unavailable.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-zinc-500">
                      Not available ({unavailable.length})
                    </summary>
                    <div className="mt-1.5 space-y-1 opacity-70">
                      {unavailable.map((o) => (
                        <StaffPickRow
                          key={o.email}
                          option={o}
                          selected={false}
                          disabled
                          onSelect={() => {}}
                        />
                      ))}
                    </div>
                  </details>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving || !staffEmail}
                  className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : editingShift ? "Save changes" : "Add admin shift"}
                </button>
                {editingShift && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={cancelEdit}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-semibold text-zinc-800">Lessons</h3>
            {sessions.length === 0 && holSessions.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-400">No classes this day.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {sessions.map((s) => (
                  <li key={s.sessionId}>
                    <Link
                      href={`/attendance/session/${s.sessionId}`}
                      className={`block rounded-lg border p-2.5 text-sm transition hover:opacity-80 ${calendarSessionCardClass(s.status)}`}
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
                              <div className="mt-0.5 text-xs text-zinc-500">
                                {subtitle}
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <div className="mt-0.5 text-zinc-500">{s.timeLabel}</div>
                      <div className="mt-0.5 text-xs">
                        {s.status === "inactive"
                          ? "No enrollments"
                          : s.status === "grey"
                            ? "All waived/makeup"
                            : s.status === "red" &&
                                isReliefTutorNeeded(s.reliefTutor ?? "")
                              ? `${s.expectedCount} students · Relief needed`
                              : s.status === "red"
                                ? `${s.expectedCount} student${s.expectedCount === 1 ? "" : "s"}`
                                : `${s.expectedCount} student${s.expectedCount === 1 ? "" : "s"}`}
                      </div>
                    </Link>
                  </li>
                ))}
                {holSessions.map((s) => (
                  <li key={s.sessionId}>
                    <Link
                      href={`/attendance/hol-session/${s.sessionId}`}
                      className="block rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 text-sm text-emerald-900 transition hover:opacity-80"
                    >
                      <div className="font-semibold leading-snug">{s.programmeName}</div>
                      {s.tutorName && (
                        <div className="mt-0.5 font-medium">{s.tutorName}</div>
                      )}
                      {s.timeLabel && (
                        <div className="mt-0.5 text-emerald-600">{s.timeLabel}</div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-zinc-200 px-4 py-3 text-xs">
          <button
            type="button"
            onClick={onViewWeek}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Week view
          </button>
          <Link
            href={`/people/admin-roster?month=${date.slice(0, 7)}`}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Full roster & alerts
          </Link>
        </footer>
      </aside>
    </>
  );
}
