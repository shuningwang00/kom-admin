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

export function datesForWeekdayInMonth(
  year: number,
  month: number,
  weekday: Weekday,
): string[] {
  const target = WEEKDAY_INDEX[weekday];
  if (target < 0) return [];

  const dates: string[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    if (d.getDay() === target) {
      dates.push(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export function parseYearMonth(raw: string): { year: number; month: number } | null {
  const m = raw.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}
