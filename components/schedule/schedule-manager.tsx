"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { classDurationMinutes, listStandardTimeSlots, normalizeTimeLabel } from "@/lib/scheduling/time-slots";

type Klass = {
  id: string;
  label: string;
  subject: string;
  level: string;
  time: string;
  tutor: string;
  weekday: string;
  isActive: boolean;
  isFull: boolean;
  feePerLesson: string;
  description: string;
  classroom: string;
};

type ViewMode = "grid" | "list";
type LevelFilter = "all" | "p5" | "p6" | "sec1" | "sec2" | "sec3" | "sec4" | "jc1" | "jc2";
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const LEVEL_FILTERS: { value: LevelFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "p5", label: "P5" },
  { value: "p6", label: "P6" },
  { value: "sec1", label: "Sec 1" },
  { value: "sec2", label: "Sec 2" },
  { value: "sec3", label: "Sec 3" },
  { value: "sec4", label: "Sec 4" },
  { value: "jc1", label: "JC 1" },
  { value: "jc2", label: "JC 2" },
];

const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};
const DAY_SHORT: Record<DayKey, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
const DAY_MAP: Record<string, DayKey> = {
  monday: "mon", tuesday: "tue", wednesday: "wed",
  thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun",
};

const DEFAULT_FEES: Record<LevelFilter, string> = {
  all: "", p5: "60", p6: "60", sec1: "70", sec2: "70",
  sec3: "85", sec4: "85", jc1: "100", jc2: "100",
};

const WEEKDAY_OPTIONS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

const LEVEL_OPTIONS = [
  { value: "", label: "— Select level —" },
  { value: "P5", label: "P5" },
  { value: "P6", label: "P6" },
  { value: "Sec 1", label: "Sec 1" },
  { value: "Sec 2", label: "Sec 2" },
  { value: "Sec 3", label: "Sec 3" },
  { value: "Sec 4", label: "Sec 4" },
  { value: "JC 1", label: "JC 1" },
  { value: "JC 2", label: "JC 2" },
];

function parseTime(time: string): { startMinutes: number; endMinutes: number } {
  const m = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return { startMinutes: 0, endMinutes: 0 };
  const toMins = (h: string, mn: string, ampm: string) => {
    let hr = parseInt(h, 10);
    const min = parseInt(mn || "0", 10);
    if (ampm?.toLowerCase() === "pm" && hr !== 12) hr += 12;
    if (ampm?.toLowerCase() === "am" && hr === 12) hr = 0;
    return hr * 60 + min;
  };
  const endAmPm = m[6] || m[3] || "";
  const startAmPm = m[3] || endAmPm;
  return {
    startMinutes: toMins(m[1], m[2], startAmPm),
    endMinutes: toMins(m[4], m[5], endAmPm),
  };
}

function inferLevel(label: string, level: string): LevelFilter {
  const text = `${label} ${level}`.toLowerCase();
  if (/jc\s*2/i.test(text)) return "jc2";
  if (/jc\s*1|h2\s*math/i.test(text)) return "jc1";
  if (/sec\s*4|secondary\s*4/i.test(text)) return "sec4";
  if (/sec\s*3|secondary\s*3/i.test(text)) return "sec3";
  if (/sec\s*2|secondary\s*2/i.test(text)) return "sec2";
  if (/sec\s*1|secondary\s*1/i.test(text)) return "sec1";
  if (/p6|primary\s*6/i.test(text)) return "p6";
  if (/p5|primary\s*5/i.test(text)) return "p5";
  return "all";
}

function formatFee(fee: string): string {
  if (!fee) return "";
  const n = parseFloat(fee);
  if (isNaN(n)) return fee;
  return `S$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}/lesson`;
}

function filterAndSort(all: Klass[], level: LevelFilter, weekendsOnly: boolean, showInactive: boolean): Klass[] {
  return all
    .filter((c) => {
      if (!showInactive && !c.isActive) return false;
      const day = DAY_MAP[c.weekday];
      if (weekendsOnly && day !== "sat" && day !== "sun") return false;
      if (level !== "all" && inferLevel(c.label, c.level) !== level) return false;
      return true;
    })
    .sort((a, b) => {
      const aDay = DAY_ORDER.indexOf(DAY_MAP[a.weekday] ?? "mon" as DayKey);
      const bDay = DAY_ORDER.indexOf(DAY_MAP[b.weekday] ?? "mon" as DayKey);
      if (aDay !== bDay) return aDay - bDay;
      return parseTime(a.time).startMinutes - parseTime(b.time).startMinutes;
    });
}

type FormState = {
  subject: string;
  level: string;
  weekday: string;
  time: string;
  tutor: string;
  feePerLesson: string;
  description: string;
  isFull: boolean;
  classroom: string;
};

const EMPTY_FORM: FormState = {
  subject: "", level: "", weekday: "monday", time: "", tutor: "",
  feePerLesson: "", description: "", isFull: false, classroom: "",
};

function klassToForm(c: Klass): FormState {
  return {
    subject: c.subject, level: c.level, weekday: c.weekday,
    time: normalizeTimeLabel(c.time) ?? c.time,
    tutor: c.tutor, feePerLesson: c.feePerLesson,
    description: c.description, isFull: c.isFull, classroom: c.classroom,
  };
}

function LevelBadge({ level }: { level: string }) {
  const inferred = inferLevel(level, level);
  const colors: Record<string, string> = {
    p5: "bg-sky-100 text-sky-800",
    p6: "bg-sky-100 text-sky-800",
    sec1: "bg-violet-100 text-violet-800",
    sec2: "bg-violet-100 text-violet-800",
    sec3: "bg-amber-100 text-amber-800",
    sec4: "bg-amber-100 text-amber-800",
    jc1: "bg-orange-100 text-orange-800",
    jc2: "bg-orange-100 text-orange-800",
  };
  const colorClass = colors[inferred] ?? "bg-zinc-100 text-zinc-600";
  const labels: Record<string, string> = {
    p5: "P5", p6: "P6", sec1: "Sec 1", sec2: "Sec 2",
    sec3: "Sec 3", sec4: "Sec 4", jc1: "JC 1", jc2: "JC 2",
  };
  const displayLabel = labels[inferred];
  if (!displayLabel) return null;
  return (
    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${colorClass}`}>
      {displayLabel}
    </span>
  );
}

const GRID_START_HOUR = 9;
const GRID_END_HOUR = 21;
const HOUR_PX = 120;
const MIN_PX = HOUR_PX / 60;
const LANE_H = 76;

function formatHourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function TimeGridCard({
  cls,
  left,
  width,
  canEdit,
  onEdit,
  onSetClassroom,
}: {
  cls: Klass;
  left: number;
  width: number;
  canEdit: boolean;
  onEdit: (c: Klass) => void;
  onSetClassroom: (c: Klass, classroom: string) => void;
}) {
  const inactive = !cls.isActive;
  const lv = inferLevel(cls.label, cls.level);
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    p5:   { bg: "bg-sky-50",    border: "border-sky-200",    text: "text-sky-900" },
    p6:   { bg: "bg-sky-50",    border: "border-sky-200",    text: "text-sky-900" },
    sec1: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-900" },
    sec2: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-900" },
    sec3: { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-900" },
    sec4: { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-900" },
    jc1:  { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-900" },
    jc2:  { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-900" },
  };
  const { bg, border, text } = colorMap[lv] ?? { bg: "bg-zinc-50", border: "border-zinc-200", text: "text-zinc-900" };

  return (
    <div
      className={`absolute overflow-hidden rounded-md border px-1.5 py-1 transition-opacity ${
        inactive ? "border-zinc-200 bg-zinc-50 opacity-50" : `${bg} ${border} shadow-sm`
      }`}
      style={{ left: left + 2, top: 4, bottom: 4, width: Math.max(width - 4, 20) }}
    >
      <p className={`text-[11px] font-semibold leading-tight truncate ${inactive ? "text-zinc-400" : text}`}>
        {cls.label}
      </p>
      <p className="text-[9px] leading-tight truncate text-zinc-500">{cls.time}</p>
      {cls.tutor && (
        <p className="text-[9px] leading-tight truncate text-zinc-400">{cls.tutor}</p>
      )}
      {cls.isFull && (
        <span className="inline-flex rounded-full bg-red-100 px-1 py-px text-[9px] font-semibold text-red-700">FULL</span>
      )}
      {canEdit && (
        <div className="mt-0.5 flex flex-wrap items-center gap-0.5">
          {cls.classroom ? (
            <button
              type="button"
              onClick={() => onSetClassroom(cls, "")}
              className="inline-flex items-center gap-0.5 rounded bg-orange-100 px-1 py-px text-[9px] font-semibold text-orange-700 hover:bg-orange-200"
            >
              {cls.classroom.toUpperCase()}<span className="text-orange-400">×</span>
            </button>
          ) : (
            <>
              <button type="button" onClick={() => onSetClassroom(cls, "c1")} className="rounded px-1 py-px text-[9px] font-semibold bg-zinc-100 text-zinc-500 hover:bg-zinc-200">C1</button>
              <button type="button" onClick={() => onSetClassroom(cls, "c2")} className="rounded px-1 py-px text-[9px] font-semibold bg-zinc-100 text-zinc-500 hover:bg-zinc-200">C2</button>
            </>
          )}
          <button type="button" onClick={() => onEdit(cls)} className="rounded p-px text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" title="Edit">
            <PencilIcon />
          </button>
        </div>
      )}
    </div>
  );
}

function GridView({
  classes,
  weekendsOnly,
  canEdit,
  onEdit,
  onSetClassroom,
}: {
  classes: Klass[];
  weekendsOnly: boolean;
  canEdit: boolean;
  onEdit: (c: Klass) => void;
  onSetClassroom: (c: Klass, classroom: string) => void;
}) {
  const visibleDays = weekendsOnly ? (["sat", "sun"] as DayKey[]) : DAY_ORDER;

  if (classes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
        <p className="text-sm text-zinc-500">No classes match your filters.</p>
      </div>
    );
  }

  const allParsed = classes.map((c) => parseTime(c.time)).filter((t) => t.startMinutes > 0);
  const startHour = allParsed.length > 0
    ? Math.min(GRID_START_HOUR, Math.floor(Math.min(...allParsed.map((t) => t.startMinutes)) / 60))
    : GRID_START_HOUR;
  const endHour = GRID_END_HOUR;
  const totalHours = endHour - startHour;
  const gridW = totalHours * HOUR_PX;
  const startMin = startHour * 60;

  function timeToLeft(m: number) { return (m - startMin) * MIN_PX; }
  function durToWidth(d: number) { return d * MIN_PX; }

  return (
    <div className="overflow-auto rounded-xl border border-zinc-200 bg-white" style={{ maxHeight: "calc(100vh - 220px)" }}>
      <table className="border-collapse" style={{ width: 56 + 32 + gridW }}>
        <thead>
          <tr className="border-b-2 border-zinc-200 bg-zinc-50">
            <th className="sticky left-0 top-0 z-20 w-14 border-r border-zinc-200 bg-zinc-50 p-0" />
            <th className="sticky left-14 top-0 z-20 w-8 border-r border-zinc-200 bg-zinc-50 p-0" />
            <th className="sticky top-0 z-[9] bg-zinc-50 p-0">
              <div className="relative select-none" style={{ width: gridW, height: 36 }}>
                {Array.from({ length: totalHours }, (_, i) => {
                  const h = startHour + i;
                  return (
                    <div key={h} className="absolute top-0 bottom-0" style={{ left: i * HOUR_PX }}>
                      <div className="absolute inset-y-0 border-l border-zinc-200" />
                      <span className="absolute top-1 left-1.5 text-[10px] font-medium text-zinc-500 whitespace-nowrap">
                        {formatHourLabel(h)}
                      </span>
                      {[1, 2, 3].map((q) => (
                        <div key={q} className="absolute inset-y-0 border-l border-zinc-100" style={{ left: q * 30 }} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleDays.map((day) => {
            const daySessions = classes.filter((c) => DAY_MAP[c.weekday] === day);
            const c1 = daySessions.filter((c) => c.classroom === "c1");
            const c2 = daySessions.filter((c) => c.classroom === "c2");
            const unassigned = daySessions.filter((c) => !c.classroom);
            const lanes = [
              { key: "c1", label: "C1", items: c1, laneBg: "bg-blue-50", laneText: "text-blue-400" },
              { key: "c2", label: "C2", items: c2, laneBg: "bg-violet-50", laneText: "text-violet-400" },
              ...(unassigned.length > 0
                ? [{ key: "un", label: "—", items: unassigned, laneBg: "bg-zinc-50", laneText: "text-zinc-300" }]
                : []),
            ];

            return (
              <Fragment key={day}>
                {lanes.map(({ key, label, items, laneBg, laneText }, laneIdx) => (
                  <tr
                    key={key}
                    className={laneIdx === lanes.length - 1 ? "border-b-2 border-zinc-200" : "border-b border-zinc-100"}
                  >
                    {laneIdx === 0 && (
                      <td
                        rowSpan={lanes.length}
                        className="sticky left-0 z-[8] w-14 border-r border-zinc-200 bg-zinc-50 align-middle px-1 py-0"
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className="text-xs font-bold text-zinc-700">{DAY_LABELS[day].slice(0, 3)}</span>
                          <span className="text-[10px] text-zinc-400">{daySessions.length}</span>
                        </div>
                      </td>
                    )}
                    <td className={`sticky left-14 z-[8] w-8 border-r border-zinc-200 px-1 align-middle ${laneBg}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${laneText}`}>{label}</span>
                    </td>
                    <td className="p-0">
                      <div className="relative" style={{ width: gridW, height: LANE_H }}>
                        {Array.from({ length: totalHours }, (_, i) => (
                          <Fragment key={i}>
                            <div className="absolute inset-y-0 border-l border-zinc-100" style={{ left: i * HOUR_PX }} />
                            <div className="absolute inset-y-0 border-l border-zinc-50" style={{ left: i * HOUR_PX + 30 }} />
                            <div className="absolute inset-y-0 border-l border-zinc-50" style={{ left: i * HOUR_PX + 60 }} />
                            <div className="absolute inset-y-0 border-l border-zinc-50" style={{ left: i * HOUR_PX + 90 }} />
                          </Fragment>
                        ))}
                        {items.map((cls) => {
                          const { startMinutes, endMinutes } = parseTime(cls.time);
                          if (!startMinutes && !endMinutes) return null;
                          return (
                            <TimeGridCard
                              key={cls.id}
                              cls={cls}
                              left={timeToLeft(startMinutes)}
                              width={durToWidth(endMinutes - startMinutes)}
                              canEdit={canEdit}
                              onEdit={onEdit}
                              onSetClassroom={onSetClassroom}
                            />
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ListView({
  classes,
  canEdit,
  onEdit,
}: {
  classes: Klass[];
  canEdit: boolean;
  onEdit: (c: Klass) => void;
}) {
  if (classes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
        <p className="text-sm text-zinc-500">No classes match your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[36rem] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-3 py-2.5 font-semibold text-zinc-700">Day</th>
              <th className="px-3 py-2.5 font-semibold text-zinc-700">Class</th>
              <th className="px-3 py-2.5 font-semibold text-zinc-700">Time</th>
              <th className="px-3 py-2.5 font-semibold text-zinc-700">Tutor</th>
              <th className="px-3 py-2.5 font-semibold text-zinc-700">Fee</th>
              <th className="px-3 py-2.5 font-semibold text-zinc-700">Status</th>
              {canEdit && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => {
              const fee = formatFee(cls.feePerLesson);
              const day = DAY_MAP[cls.weekday];
              return (
                <tr
                  key={cls.id}
                  className={`border-b border-zinc-100 last:border-0 hover:bg-zinc-50 ${!cls.isActive ? "opacity-60" : ""}`}
                >
                  <td className="px-3 py-3 font-medium text-zinc-700 whitespace-nowrap">
                    {day ? DAY_SHORT[day] : cls.weekday}
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-medium text-zinc-900">{cls.label}</span>
                    {cls.description && (
                      <p className="mt-0.5 text-xs text-zinc-400 max-w-xs truncate">{cls.description}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-zinc-600 whitespace-nowrap">{cls.time || "—"}</td>
                  <td className="px-3 py-3 text-zinc-600">{cls.tutor || "—"}</td>
                  <td className="px-3 py-3 text-zinc-600 whitespace-nowrap">{fee || "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {cls.isFull && (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          FULL
                        </span>
                      )}
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls.isActive ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-500"}`}>
                        {cls.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </td>
                  {canEdit && (
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => onEdit(cls)}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        title="Edit"
                      >
                        <PencilIcon />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-400">
        {classes.length} class{classes.length === 1 ? "" : "es"}
      </p>
    </div>
  );
}

function ClassForm({
  initial,
  editTarget,
  tutorOptions,
  onSave,
  onClose,
  onDeactivate,
  onReactivate,
  onDelete,
  saving,
}: {
  initial: FormState;
  editTarget: Klass | null;
  tutorOptions: string[];
  onSave: (form: FormState) => Promise<void>;
  onClose: () => void;
  onDeactivate?: () => void;
  onReactivate?: () => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);

  const timeOptions = useMemo(() => {
    const slots = listStandardTimeSlots(classDurationMinutes(form.level));
    if (form.time && !slots.includes(form.time)) {
      return [form.time, ...slots];
    }
    return slots;
  }, [form.level, form.time]);

  const tutorSelectOptions = useMemo(() => {
    if (form.tutor && !tutorOptions.includes(form.tutor)) {
      return [form.tutor, ...tutorOptions];
    }
    return tutorOptions;
  }, [tutorOptions, form.tutor]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(field: keyof FormState, value: string | boolean) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "level") {
        const inferred = inferLevel(String(value), String(value));
        if (!prev.feePerLesson && DEFAULT_FEES[inferred]) {
          next.feePerLesson = DEFAULT_FEES[inferred];
        }
      }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="font-semibold text-zinc-900">{editTarget ? "Edit class" : "Add class"}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-zinc-400 hover:text-zinc-700">
            <CloseIcon />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave(form);
          }}
          className="space-y-3 p-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Level</label>
              <select
                value={form.level}
                onChange={(e) => set("level", e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
              >
                {LEVEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Subject *</label>
              <input
                required
                value={form.subject}
                onChange={(e) => set("subject", e.target.value)}
                placeholder="e.g. G3 Math"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Day *</label>
              <select
                required
                value={form.weekday}
                onChange={(e) => set("weekday", e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
              >
                {WEEKDAY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Time</label>
              <select
                value={form.time}
                onChange={(e) => set("time", e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
              >
                <option value="">— Select time —</option>
                {timeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Fee per lesson (S$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.feePerLesson}
                onChange={(e) => set("feePerLesson", e.target.value)}
                placeholder="e.g. 70"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Tutor</label>
              <select
                value={form.tutor}
                onChange={(e) => set("tutor", e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
              >
                <option value="">— Select tutor —</option>
                {tutorSelectOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Classroom</label>
              <select
                value={form.classroom}
                onChange={(e) => set("classroom", e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
              >
                <option value="">— Unassigned —</option>
                <option value="c1">C1</option>
                <option value="c2">C2</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-zinc-700">Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Optional description for the website"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
              />
            </div>
            <div className="col-span-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={form.isFull}
                  onChange={(e) => set("isFull", e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 accent-orange-600"
                />
                Mark as full (hides from public sign-up)
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-zinc-100 pt-3">
            {editTarget && (
              <>
                {editTarget.isActive ? (
                  <button
                    type="button"
                    onClick={onDeactivate}
                    disabled={saving}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onReactivate}
                    disabled={saving}
                    className="rounded-lg border border-green-200 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
                  >
                    Reactivate
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={saving}
                  className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  Delete
                </button>
              </>
            )}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ScheduleManager() {
  const [allClasses, setAllClasses] = useState<Klass[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [weekendsOnly, setWeekendsOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Klass | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/classes?all=1");
    const data = (await res.json()) as { classes: Klass[]; canEdit?: boolean; error?: string };
    if (!res.ok) {
      setError(data.error ?? `Failed to load schedule (${res.status})`);
      setLoading(false);
      return;
    }
    setAllClasses(data.classes);
    setCanEdit(data.canEdit === true);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditTarget(null);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(c: Klass) {
    setEditTarget(c);
    setFormError("");
    setFormOpen(true);
  }

  async function handleSave(form: FormState) {
    setSaving(true);
    setFormError("");
    try {
      let res: Response;
      if (editTarget) {
        res = await fetch(`/api/classes/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch("/api/classes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      const data = (await res.json()) as { class?: Klass; error?: string };
      if (!res.ok) {
        setFormError(data.error ?? "Failed to save");
        setSaving(false);
        return;
      }
      setFormOpen(false);
      if (data.class) {
        if (editTarget) {
          setAllClasses((prev) => prev.map((x) => (x.id === data.class!.id ? data.class! : x)));
        } else {
          setAllClasses((prev) => [...prev, data.class!]);
        }
      } else {
        await load();
      }
    } catch {
      setFormError("Network error");
    }
    setSaving(false);
  }

  async function handleDeactivate(c: Klass) {
    if (!confirm(`Deactivate "${c.label}"? It will be hidden from the schedule.`)) return;
    const res = await fetch(`/api/classes/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      setAllClasses((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, isActive: false } : x))
      );
      setFormOpen(false);
    }
  }

  async function handleDelete(c: Klass) {
    if (!confirm(`Permanently delete "${c.label}"? This will also delete all sessions and enrolments for this class. This cannot be undone.`)) return;
    const res = await fetch(`/api/classes/${c.id}?hard=1`, { method: "DELETE" });
    if (res.ok) {
      setAllClasses((prev) => prev.filter((x) => x.id !== c.id));
      setFormOpen(false);
    }
  }

  async function handleReactivate(c: Klass) {
    const res = await fetch(`/api/classes/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    if (res.ok) {
      setAllClasses((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, isActive: true } : x))
      );
      setFormOpen(false);
    }
  }

  async function handleSetClassroom(c: Klass, classroom: string) {
    const res = await fetch(`/api/classes/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classroom }),
    });
    if (res.ok) {
      setAllClasses((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, classroom } : x))
      );
    }
  }

  const filtered = filterAndSort(allClasses, levelFilter, weekendsOnly, showInactive);
  const activeCount = allClasses.filter((c) => c.isActive).length;
  const fullCount = allClasses.filter((c) => c.isActive && c.isFull).length;
  const tutorOptions = useMemo(() => {
    const names = [...new Set(allClasses.map((c) => c.tutor).filter(Boolean))];
    return names.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  }, [allClasses]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex flex-wrap gap-3 text-sm text-zinc-500">
        <span>{activeCount} active class{activeCount === 1 ? "" : "es"}</span>
        {fullCount > 0 && <span>· {fullCount} full</span>}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* View toggle */}
        <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
          {(["grid", "list"] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                view === v
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Level filters */}
        <div className="flex flex-wrap gap-1">
          {LEVEL_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setLevelFilter(f.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                levelFilter === f.value
                  ? "bg-orange-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Weekends toggle */}
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={weekendsOnly}
              onChange={(e) => setWeekendsOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 accent-orange-600"
            />
            Weekends only
          </label>

          {/* Show inactive */}
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 accent-orange-600"
            />
            Show inactive
          </label>

          {/* Add button */}
          {canEdit && (
            <button
              type="button"
              onClick={openAdd}
              className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700"
            >
              + Add class
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : view === "grid" ? (
        <GridView
          classes={filtered}
          weekendsOnly={weekendsOnly}
          canEdit={canEdit}
          onEdit={openEdit}
          onSetClassroom={handleSetClassroom}
        />
      ) : (
        <ListView
          classes={filtered}
          canEdit={canEdit}
          onEdit={openEdit}
        />
      )}

      {formOpen && (
        <ClassForm
          initial={editTarget ? klassToForm(editTarget) : EMPTY_FORM}
          editTarget={editTarget}
          tutorOptions={tutorOptions}
          onSave={handleSave}
          onClose={() => setFormOpen(false)}
          onDeactivate={editTarget ? () => handleDeactivate(editTarget) : undefined}
          onReactivate={editTarget ? () => handleReactivate(editTarget) : undefined}
          onDelete={editTarget ? () => handleDelete(editTarget) : undefined}
          saving={saving}
        />
      )}
      {formError && formOpen && (
        <p className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          {formError}
        </p>
      )}
    </div>
  );
}

/* ── Icons ── */

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FullIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 8 12 12 14 14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
