import { formatClassDropdownLabel, formatClassTypeLabel } from "@/lib/classes/display-label";
import { attachExpectedAttendance } from "@/lib/attendance/expected-counts";
import { RELIEF_TUTOR_NEEDED_VALUE } from "@/lib/tutors/constants";
import { formatCalendarDate, parseYearMonth } from "@/lib/dates/calendar";
import { getDb } from "@/lib/db/index";
import { classSessions, classes, tutorOoo } from "@/lib/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";

export type CalendarSessionStatus = "normal" | "blue" | "grey" | "inactive" | "red";

export type CalendarSessionItem = {
  sessionId: string;
  classId: string;
  classLabel: string;
  /** Compact chip label: e.g. "S1 G3 Math ZINING" — no weekday or time. */
  chipLabel: string;
  /** Class type only, no tutor: e.g. "S1 G3 Math". */
  typeLabel: string;
  level: string;
  tutor: string;
  timeLabel: string;
  scheduledDate: string;
  expectedCount: number;
  status: CalendarSessionStatus;
  reliefTutor: string;
  rescheduleNote: string;
};

export type CalendarDayData = {
  date: string;
  sessions: CalendarSessionItem[];
};

export type CalendarOooRecord = {
  id: string;
  tutorMatch: string;
  startDate: string;
  endDate: string;
  reason: string;
  createdBy: string;
};

export type CalendarMonthData = {
  yearMonth: string;
  days: CalendarDayData[];
  oooRecords: CalendarOooRecord[];
};

export async function loadCalendarMonth(yearMonth: string): Promise<CalendarMonthData> {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) throw new Error("Use yearMonth format YYYY-MM");

  const { year, month } = parsed;
  const startDate = formatCalendarDate(year, month, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = formatCalendarDate(year, month, lastDay);

  const db = getDb();

  const sessionRows = await db
    .select({ session: classSessions, class: classes })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(
      and(
        gte(classSessions.scheduledDate, startDate),
        lte(classSessions.scheduledDate, endDate),
        eq(classes.isActive, true),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate), asc(classes.time));

  const withExpected = await attachExpectedAttendance(sessionRows);

  const oooRows = await db
    .select()
    .from(tutorOoo)
    .where(
      and(
        lte(tutorOoo.startDate, endDate),
        gte(tutorOoo.endDate, startDate),
      ),
    )
    .orderBy(tutorOoo.startDate);

  // Build a set of "YYYY-MM-DD:TUTOR" for O(1) lookup
  const oooKeys = new Set<string>();
  for (const ooo of oooRows) {
    let d = new Date(ooo.startDate + "T00:00:00");
    const end = new Date(ooo.endDate + "T00:00:00");
    while (d <= end) {
      const iso = formatCalendarDate(
        d.getFullYear(),
        d.getMonth() + 1,
        d.getDate(),
      );
      oooKeys.add(`${iso}:${ooo.tutorMatch.trim().toUpperCase()}`);
      d.setDate(d.getDate() + 1);
    }
  }

  const byDate = new Map<string, CalendarSessionItem[]>();
  for (const row of withExpected) {
    const date = row.session.scheduledDate;
    if (!byDate.has(date)) byDate.set(date, []);

    const tutorRaw = row.class.tutor.trim();
    const isOoo = oooKeys.has(`${date}:${tutorRaw.toUpperCase()}`);
    const needsRelief = row.session.reliefTutor === RELIEF_TUTOR_NEEDED_VALUE;
    const expectedCount = row.expected.regular + row.expected.makeup + row.expected.trial;

    const hasTrial = row.expected.trial > 0;
    const hasEnrollments = row.rosterSize > 0;

    let status: CalendarSessionStatus = "normal";
    if (isOoo || needsRelief) {
      status = "red";
    } else if (hasTrial) {
      status = "blue";
    } else if (expectedCount === 0 && !hasEnrollments) {
      status = "inactive";
    } else if (expectedCount === 0) {
      status = "grey";
    }

    const typeLabel = formatClassTypeLabel(row.class);
    byDate.get(date)!.push({
      sessionId: row.session.id,
      classId: row.class.id,
      classLabel: formatClassDropdownLabel(row.class),
      chipLabel: tutorRaw ? `${typeLabel} ${tutorRaw}` : typeLabel,
      typeLabel,
      level: row.class.level,
      tutor: row.class.tutor,
      timeLabel: row.session.timeLabel || row.class.time,
      scheduledDate: date,
      expectedCount,
      status,
      reliefTutor: row.session.reliefTutor,
      rescheduleNote: row.session.rescheduleNote,
    });
  }

  // Build full month day array
  const days: CalendarDayData[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const iso = formatCalendarDate(year, month, day);
    days.push({ date: iso, sessions: byDate.get(iso) ?? [] });
  }

  return {
    yearMonth,
    days,
    oooRecords: oooRows.map((o) => ({
      id: o.id,
      tutorMatch: o.tutorMatch,
      startDate: o.startDate,
      endDate: o.endDate,
      reason: o.reason,
      createdBy: o.createdBy,
    })),
  };
}
