import { isMakeupLessonSession } from "@/lib/attendance/makeup-session-rules";
import { formatWeekdayLabel } from "@/lib/classes/display-label";
import { weekdayIndexFromCalendarDate } from "@/lib/dates/calendar";
import { sessionIsoDate } from "@/lib/dates/session-date";
import { sessionTutorDisplay } from "@/lib/tutors/display";

const INDEX_TO_WEEKDAY = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export function formatShortDate(iso: string): string {
  const norm = sessionIsoDate(iso);
  const [, y, m, d] = norm.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  if (m && d) return `${d}/${m}`;
  const parts = iso.split("-");
  if (parts.length >= 3) return `${parts[2]}/${parts[1]}`;
  return iso;
}

/** On the M/U lesson session, show which regular lesson was missed (not the MU day). */
export function formatMakeupNoteForMuLessonDay(
  sessionDate: string,
  makeupNote: string,
  missedDateIso: string | null | undefined,
): string {
  const note = makeupNote.trim();
  if (!note) return "";
  if (!isMakeupLessonSession(sessionDate, note)) return note;
  if (missedDateIso) {
    return `M/U for lesson missed on ${formatShortDate(missedDateIso)}`;
  }
  return note;
}

export function formatDayLabelFromIsoDate(iso: string): string {
  const idx = weekdayIndexFromCalendarDate(iso);
  const weekday = INDEX_TO_WEEKDAY[idx] ?? "other";
  return formatWeekdayLabel(weekday);
}

export function formatScheduledMakeupMuLine(row: {
  makeupDate: string;
  makeupDayLabel: string;
  makeupProgrammeType: string;
  timeLabel: string;
  makeupRegularTutor: string;
  makeupReliefTutor: string;
}): string {
  const parts = [
    `M/U on ${formatShortDate(row.makeupDate)}`,
    row.makeupDayLabel,
    row.makeupProgrammeType,
  ];
  const time = row.timeLabel.trim();
  if (time) parts.push(time);
  const tutor = sessionTutorDisplay(
    row.makeupRegularTutor,
    row.makeupReliefTutor,
  ).primary;
  if (tutor && tutor !== "—") parts.push(tutor);
  return parts.join(" · ");
}

export function formatScheduledMakeupMissedLine(row: {
  missedDate: string;
  missedDayLabel: string;
}): string {
  return `Missed ${formatShortDate(row.missedDate)} · ${row.missedDayLabel}`;
}

/** Date + time for WhatsApp reminders, e.g. `25/05 (Sun), 9am to 1045am`. */
export function formatMakeupDateTimeForMessage(row: {
  makeupDate: string;
  makeupDayLabel: string;
  timeLabel: string;
}): string {
  const time = row.timeLabel.trim();
  const datePart = `${formatShortDate(row.makeupDate)} (${row.makeupDayLabel})`;
  return time ? `${datePart}, ${time}` : datePart;
}
