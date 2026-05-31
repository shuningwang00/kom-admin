import type { Weekday } from "@/lib/scheduling/weekday";

const WEEKDAY_INDEX: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  other: -1,
};

/** YYYY-MM-DD from calendar parts (no UTC shift). */
export function formatCalendarDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Today's date in the user's browser (attendance date picker). */
export function todayCalendarDate(): string {
  const d = new Date();
  return formatCalendarDate(
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
  );
}

/** All dates in a month matching a weekday — uses calendar math, not UTC ISO strings. */
export function datesForWeekdayInMonth(
  year: number,
  month: number,
  weekday: Weekday,
): string[] {
  const target = WEEKDAY_INDEX[weekday];
  if (target < 0) return [];

  const dates: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day, 12, 0, 0).getDay();
    if (dow === target) {
      dates.push(formatCalendarDate(year, month, day));
    }
  }

  return dates;
}

/** Calendar weekday 0=Sun … 6=Sat for a YYYY-MM-DD date (no UTC shift). */
export function weekdayIndexFromCalendarDate(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getDay();
}

const INDEX_TO_WEEKDAY: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function weekdayFromCalendarDate(iso: string): Weekday {
  const idx = weekdayIndexFromCalendarDate(iso);
  return INDEX_TO_WEEKDAY[idx] ?? "other";
}

/** Regular classes only run on their timetable weekday. */
export function sessionDateMatchesClassWeekday(
  sessionDate: string,
  classWeekday: Weekday,
): boolean {
  if (classWeekday === "other") return true;
  return weekdayFromCalendarDate(sessionDate) === classWeekday;
}

/** First date strictly after `afterIso` that falls on `weekday`. */
export function nextDateForWeekdayAfter(
  afterIso: string,
  weekday: Weekday,
): string | null {
  const target = WEEKDAY_INDEX[weekday];
  if (target < 0) return null;

  const [y, m, d] = afterIso.split("-").map(Number);
  const cursor = new Date(y, m - 1, d, 12, 0, 0);

  for (let i = 0; i < 370; i++) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() === target) {
      return formatCalendarDate(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        cursor.getDate(),
      );
    }
  }
  return null;
}

export function parseYearMonth(
  raw: string,
): { year: number; month: number } | null {
  const m = raw.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}
