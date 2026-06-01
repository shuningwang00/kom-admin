/** Default centre hours for availability quick-fill (staff may extend outside). */

export type TimeSlot = { start: string; end: string; label: string };

export function isWeekendDate(isoDate: string): boolean {
  const dow = new Date(`${isoDate}T12:00:00`).getDay();
  return dow === 0 || dow === 6;
}

/** Weekday 3–8pm; Sat/Sun 9am–6pm. */
export function defaultSlotsForDate(isoDate: string): TimeSlot[] {
  if (isWeekendDate(isoDate)) {
    return [{ start: "09:00", end: "18:00", label: "Weekend" }];
  }
  return [{ start: "15:00", end: "20:00", label: "Weekday" }];
}

/** Default admin roster shift window for a calendar date. */
export function defaultRosterShiftTimes(isoDate: string): {
  startTime: string;
  endTime: string;
} {
  const slot = defaultSlotsForDate(isoDate)[0];
  return { startTime: slot.start, endTime: slot.end };
}

export function normalizeTime(t: string): string {
  const raw = t.trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return raw;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** True if availability slot fully covers a roster shift (HH:mm, 24h). */
export function slotCoversShift(
  avail: { startTime: string; endTime: string },
  shift: { startTime: string; endTime: string },
): boolean {
  const a0 = normalizeTime(avail.startTime);
  const a1 = normalizeTime(avail.endTime);
  const s0 = normalizeTime(shift.startTime);
  const s1 = normalizeTime(shift.endTime);
  return a0 <= s0 && a1 >= s1;
}

export function daysInMonth(yearMonth: string): string[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    out.push(
      `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  return out;
}

/** Month staff should usually submit by the 25th (next calendar month). */
export function suggestedAvailabilityMonth(): string {
  const now = new Date();
  const day = now.getDate();
  const y = now.getFullYear();
  const m = now.getMonth();
  const target = day >= 20 ? new Date(y, m + 1, 1) : new Date(y, m, 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
}
