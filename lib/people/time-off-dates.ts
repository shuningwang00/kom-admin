import { formatCalendarDate } from "@/lib/dates/calendar";

export type DateRange = { startDate: string; endDate: string };

/** Inclusive calendar dates between two ISO dates. */
export function datesInInclusiveRange(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  let d = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  while (d <= end) {
    out.push(
      formatCalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
    );
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function isDateInTimeOff(isoDate: string, ranges: DateRange[]): boolean {
  return ranges.some((r) => isoDate >= r.startDate && isoDate <= r.endDate);
}

export function todayCalendarIso(): string {
  const now = new Date();
  return formatCalendarDate(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
  );
}

function calendarDaysBetween(fromIso: string, toIso: string): number {
  const ms =
    new Date(`${toIso}T12:00:00`).getTime() -
    new Date(`${fromIso}T12:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

/** 0 if today falls in the range; otherwise days until start or since end. */
export function timeOffDistanceFromToday(
  startDate: string,
  endDate: string,
  today = todayCalendarIso(),
): number {
  if (today >= startDate && today <= endDate) return 0;
  if (today < startDate) return calendarDaysBetween(today, startDate);
  return calendarDaysBetween(endDate, today);
}

/** Ongoing → upcoming → past when distance ties. */
export function timeOffProximityGroup(
  startDate: string,
  endDate: string,
  today = todayCalendarIso(),
): number {
  if (today >= startDate && today <= endDate) return 0;
  if (today < startDate) return 1;
  return 2;
}

export function compareTimeOffByProximity(
  a: DateRange,
  b: DateRange,
  today = todayCalendarIso(),
): number {
  const distA = timeOffDistanceFromToday(a.startDate, a.endDate, today);
  const distB = timeOffDistanceFromToday(b.startDate, b.endDate, today);
  if (distA !== distB) return distA - distB;

  const groupA = timeOffProximityGroup(a.startDate, a.endDate, today);
  const groupB = timeOffProximityGroup(b.startDate, b.endDate, today);
  if (groupA !== groupB) return groupA - groupB;

  const byStart = a.startDate.localeCompare(b.startDate);
  if (byStart !== 0) return byStart;
  return a.endDate.localeCompare(b.endDate);
}

export function timeOffDatesInMonth(
  ranges: DateRange[],
  yearMonth: string,
): Set<string> {
  const [y, m] = yearMonth.split("-").map(Number);
  const monthStart = formatCalendarDate(y, m, 1);
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = formatCalendarDate(y, m, lastDay);
  const blocked = new Set<string>();
  for (const r of ranges) {
    if (r.endDate < monthStart || r.startDate > monthEnd) continue;
    const start = r.startDate > monthStart ? r.startDate : monthStart;
    const end = r.endDate < monthEnd ? r.endDate : monthEnd;
    for (const d of datesInInclusiveRange(start, end)) {
      blocked.add(d);
    }
  }
  return blocked;
}
