import { todayCalendarDate } from "@/lib/dates/calendar";

const STORAGE_KEY = "kom.attendance.daily-date";

function isIsoCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Last date chosen on Attendance (daily); falls back to today when unset. */
export function readAttendanceDailyDate(): string {
  if (typeof window === "undefined") return todayCalendarDate();
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && isIsoCalendarDate(stored)) return stored;
  } catch {
    // private mode / blocked storage
  }
  return todayCalendarDate();
}

export function writeAttendanceDailyDate(iso: string): void {
  if (typeof window === "undefined" || !isIsoCalendarDate(iso)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, iso);
  } catch {
    // ignore
  }
}
