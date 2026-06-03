import { formatClassDropdownLabel, formatClassTypeLabel } from "@/lib/classes/display-label";
import { attachExpectedAttendance } from "@/lib/attendance/expected-counts";
import { tutorCanAccessClass } from "@/lib/auth/user";
import {
  hasAssignedReliefTutor,
  isReliefTutorNeeded,
} from "@/lib/tutors/constants";
import { parseTimeRange } from "@/lib/scheduling/time-slots";
import {
  clearReliefTutorNeededWhereNoStudents,
  sessionActiveExpectedTotal,
  sessionShowsReliefTutorNeeded,
} from "@/lib/attendance/relief-tutor-session";
import { sessionTutorDisplay } from "@/lib/tutors/display";
import { formatCalendarDate, parseYearMonth } from "@/lib/dates/calendar";
import { getDb } from "@/lib/db/index";
import {
  calendarEvents,
  classSessions,
  classes,
  holidayProgrammes,
  holidayProgrammeParticipants,
  holidayProgrammeSessions,
  tutorOoo,
} from "@/lib/db/schema";
import { listRosterShifts } from "@/lib/people/admin-roster";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";

export type CalendarSessionStatus =
  | "normal"
  | "relief"
  | "blue"
  | "grey"
  | "inactive"
  | "red"
  | "cancelled";

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
  sessionStatus: "scheduled" | "cancelled";
  reliefTutor: string;
  rescheduleNote: string;
};

export type CalendarAdminShift = {
  id: string;
  staffEmail: string;
  staffName: string;
  startTime: string;
  endTime: string;
  published: boolean;
};

export type DayCoverageStatus = "ok" | "no_admin_no_class" | "no_admin_has_class";

export type CalendarEventItem = {
  id: string;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  notes: string;
  createdBy: string;
};

export type CalendarHolSessionItem = {
  sessionId: string;
  programmeId: string;
  programmeName: string;
  tutorName: string;
  timeLabel: string;
  scheduledDate: string;
  newCount: number;
  existingCount: number;
};

export type CalendarDayData = {
  date: string;
  sessions: CalendarSessionItem[];
  holSessions: CalendarHolSessionItem[];
  adminShifts: CalendarAdminShift[];
  events: CalendarEventItem[];
  coverageStatus: DayCoverageStatus;
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

function sessionVisibleToTutor(
  classTutor: string,
  reliefTutor: string,
  tutorMatch: string,
): boolean {
  if (tutorCanAccessClass(classTutor, tutorMatch)) return true;
  const relief = reliefTutor.trim();
  if (!relief || isReliefTutorNeeded(relief)) return false;
  return tutorCanAccessClass(relief, tutorMatch);
}

export async function loadCalendarMonth(
  yearMonth: string,
  opts?: { includeDraftShifts?: boolean; tutorMatch?: string },
): Promise<CalendarMonthData> {
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
        inArray(classSessions.status, ["scheduled", "cancelled"]),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate), asc(classes.time));

  const [withExpectedRaw, oooRows, publishedShifts, holSessionRows, eventRows] =
    await Promise.all([
      attachExpectedAttendance(sessionRows),
      db
        .select()
        .from(tutorOoo)
        .where(and(lte(tutorOoo.startDate, endDate), gte(tutorOoo.endDate, startDate)))
        .orderBy(tutorOoo.startDate),
      listRosterShifts(db, yearMonth, {
        publishedOnly: !opts?.includeDraftShifts,
      }),
      db
        .select({ session: holidayProgrammeSessions, programme: holidayProgrammes })
        .from(holidayProgrammeSessions)
        .innerJoin(
          holidayProgrammes,
          eq(holidayProgrammeSessions.programmeId, holidayProgrammes.id),
        )
        .where(
          and(
            gte(holidayProgrammeSessions.scheduledDate, startDate),
            lte(holidayProgrammeSessions.scheduledDate, endDate),
            eq(holidayProgrammes.isActive, true),
          ),
        )
        .orderBy(asc(holidayProgrammeSessions.scheduledDate)),
      db
        .select()
        .from(calendarEvents)
        .where(and(gte(calendarEvents.eventDate, startDate), lte(calendarEvents.eventDate, endDate)))
        .orderBy(asc(calendarEvents.eventDate), asc(calendarEvents.startTime)),
    ]);

  await clearReliefTutorNeededWhereNoStudents(db, withExpectedRaw);
  const withExpected = withExpectedRaw.map((row) => {
    if (
      isReliefTutorNeeded(row.session.reliefTutor ?? "") &&
      sessionActiveExpectedTotal(row.expected) === 0
    ) {
      return {
        ...row,
        session: { ...row.session, reliefTutor: "" },
      };
    }
    return row;
  });

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

  const tutorScope = opts?.tutorMatch?.trim() ?? "";

  const byDate = new Map<string, CalendarSessionItem[]>();
  for (const row of withExpected) {
    const date = row.session.scheduledDate;
    if (!byDate.has(date)) byDate.set(date, []);

    const tutorRaw = row.class.tutor.trim();
    if (
      tutorScope &&
      !sessionVisibleToTutor(
        tutorRaw,
        row.session.reliefTutor ?? "",
        tutorScope,
      )
    ) {
      continue;
    }
    const isOoo = oooKeys.has(`${date}:${tutorRaw.toUpperCase()}`);
    const reliefRaw = row.session.reliefTutor ?? "";
    const needsRelief = sessionShowsReliefTutorNeeded(reliefRaw, row.expected);
    const reliefCover = hasAssignedReliefTutor(reliefRaw);
    const expectedCount = sessionActiveExpectedTotal(row.expected);
    const hasStudentsExpected = expectedCount > 0;

    const hasTrial = row.expected.trial > 0;
    const hasEnrollments = row.rosterSize > 0;

    const sessionStatus =
      row.session.status === "cancelled" ? "cancelled" : "scheduled";

    let status: CalendarSessionStatus = "normal";
    if (sessionStatus === "cancelled") {
      status = "cancelled";
    } else if (
      needsRelief ||
      (isOoo && !reliefCover && hasStudentsExpected)
    ) {
      status = "red";
    } else if (reliefCover) {
      status = "relief";
    } else if (hasTrial) {
      status = "blue";
    } else if (expectedCount === 0 && !hasEnrollments) {
      status = "inactive";
    } else if (expectedCount === 0) {
      status = "grey";
    }

    const typeLabel = formatClassTypeLabel(row.class);
    const { primary: teachingTutor } = sessionTutorDisplay(
      row.class.tutor,
      row.session.reliefTutor ?? "",
    );
    byDate.get(date)!.push({
      sessionId: row.session.id,
      classId: row.class.id,
      classLabel: formatClassDropdownLabel(row.class),
      chipLabel:
        sessionStatus === "cancelled"
          ? `Cancelled · ${teachingTutor ? `${typeLabel} ${teachingTutor}` : typeLabel}`
          : teachingTutor
            ? `${typeLabel} ${teachingTutor}`
            : typeLabel,
      typeLabel,
      level: row.class.level,
      tutor: row.class.tutor,
      timeLabel: row.session.timeLabel || row.class.time,
      scheduledDate: date,
      expectedCount,
      status,
      sessionStatus,
      reliefTutor: row.session.reliefTutor,
      rescheduleNote: row.session.rescheduleNote,
    });
  }

  const holByDate = new Map<string, CalendarHolSessionItem[]>();
  if (holSessionRows.length > 0) {
    const holProgrammeIds = [...new Set(holSessionRows.map((r) => r.session.programmeId))];
    const participantTypeRows = await db
      .select({
        programmeId: holidayProgrammeParticipants.programmeId,
        studentId: holidayProgrammeParticipants.studentId,
      })
      .from(holidayProgrammeParticipants)
      .where(inArray(holidayProgrammeParticipants.programmeId, holProgrammeIds));

    const typeByProgramme = new Map<string, { newCount: number; existingCount: number }>();
    for (const p of participantTypeRows) {
      if (!typeByProgramme.has(p.programmeId))
        typeByProgramme.set(p.programmeId, { newCount: 0, existingCount: 0 });
      const counts = typeByProgramme.get(p.programmeId)!;
      if (p.studentId) counts.existingCount++;
      else counts.newCount++;
    }

    for (const row of holSessionRows) {
      const date = row.session.scheduledDate;
      if (!holByDate.has(date)) holByDate.set(date, []);
      const { newCount, existingCount } = typeByProgramme.get(row.session.programmeId) ?? { newCount: 0, existingCount: 0 };
      holByDate.get(date)!.push({
        sessionId: row.session.id,
        programmeId: row.session.programmeId,
        programmeName: row.programme.name,
        tutorName: row.session.tutorName,
        timeLabel: row.session.timeLabel,
        scheduledDate: date,
        newCount,
        existingCount,
      });
    }
  }

  const eventsByDate = new Map<string, CalendarEventItem[]>();
  for (const e of eventRows) {
    if (!eventsByDate.has(e.eventDate)) eventsByDate.set(e.eventDate, []);
    eventsByDate.get(e.eventDate)!.push({
      id: e.id,
      title: e.title,
      eventDate: e.eventDate,
      startTime: e.startTime,
      endTime: e.endTime,
      notes: e.notes,
      createdBy: e.createdBy,
    });
  }

  const adminByDate = new Map<string, CalendarAdminShift[]>();
  if (!tutorScope) {
  for (const s of publishedShifts) {
    if (!adminByDate.has(s.shiftDate)) adminByDate.set(s.shiftDate, []);
    adminByDate.get(s.shiftDate)!.push({
      id: s.id,
      staffEmail: s.staffEmail,
      staffName: s.staffName,
      startTime: s.startTime,
      endTime: s.endTime,
      published: s.published,
    });
  }
  }

  const days: CalendarDayData[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const iso = formatCalendarDate(year, month, day);
    const sessions = (byDate.get(iso) ?? []).sort((a, b) => {
      const aStart = parseTimeRange(a.timeLabel)?.startMinutes ?? 0;
      const bStart = parseTimeRange(b.timeLabel)?.startMinutes ?? 0;
      return aStart - bStart;
    });
    const adminShifts = adminByDate.get(iso) ?? [];
    const hasClass = sessions.some((s) => s.status !== "inactive");
    const hasAdmin = adminShifts.length > 0;
    let coverageStatus: DayCoverageStatus = "ok";
    if (!hasAdmin && hasClass) coverageStatus = "no_admin_has_class";
    else if (!hasAdmin && !hasClass) coverageStatus = "no_admin_no_class";

    days.push({
      date: iso,
      sessions,
      holSessions: holByDate.get(iso) ?? [],
      adminShifts,
      events: eventsByDate.get(iso) ?? [],
      coverageStatus,
    });
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
