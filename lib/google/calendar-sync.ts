import { and, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/lib/db/index";
import {
  adminRosterShift,
  attendanceRecords,
  calendarEvents,
  classSessions,
  classes,
  enrollments,
  holidayProgrammeAttendance,
  holidayProgrammeParticipants,
  holidayProgrammes,
  holidayProgrammeSessions,
  siteAllowlist,
  students,
  trialLeads,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { rosterForClassOnDate } from "@/lib/enrollments/roster-query";
import { filterRosterForSessionDate } from "@/lib/enrollments/eligibility";
import { isMissedLessonWithScheduledMakeup, isMuLessonAttendee, isWaivedOnSession } from "@/lib/attendance/makeup-session-rules";
import {
  deleteCalendarEvent,
  listKomEvents,
  upsertCalendarEvent,
  type GCalEventPayload,
} from "@/lib/google/calendar";

export type SyncResult = {
  sessions: { synced: number; errors: number };
  events: { synced: number; errors: number };
  shifts: { synced: number; errors: number };
  holidaySessions: { synced: number; errors: number };
  orphansDeleted: number;
  dryRun: boolean;
};

const SGT = "Asia/Singapore";

// ── Helpers ──────────────────────────────────────────────────────────────────

function sgtToday(): string {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function sgtDatePlus(days: number): string {
  const now = new Date();
  const ms = now.getTime() + 8 * 60 * 60 * 1000 + days * 86400 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Parse "9am – 10:45am" → { startH, startM, endH, endM } or null */
function parseTimeRange(raw: string): { startH: number; startM: number; endH: number; endM: number } | null {
  const m = raw.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (!m) return null;

  const toH = (h: string, mn: string, ampm: string) => {
    let hr = parseInt(h, 10);
    const min = parseInt(mn || "0", 10);
    if (ampm?.toLowerCase() === "pm" && hr !== 12) hr += 12;
    if (ampm?.toLowerCase() === "am" && hr === 12) hr = 0;
    return { hr, min };
  };

  const endAmPm = m[6] || m[3] || "";
  const startAmPm = m[3] || endAmPm;
  const s = toH(m[1], m[2], startAmPm);
  const e = toH(m[4], m[5], endAmPm);
  return { startH: s.hr, startM: s.min, endH: e.hr, endM: e.min };
}

function buildDateTimePayload(
  date: string,
  startH: number,
  startM: number,
  endH: number,
  endM: number,
): { start: GCalEventPayload["start"]; end: GCalEventPayload["end"] } {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: { dateTime: `${date}T${pad(startH)}:${pad(startM)}:00+08:00`, timeZone: SGT },
    end: { dateTime: `${date}T${pad(endH)}:${pad(endM)}:00+08:00`, timeZone: SGT },
  };
}

function buildAllDayPayload(date: string): { start: GCalEventPayload["start"]; end: GCalEventPayload["end"] } {
  // GCal all-day: end is exclusive next day
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  const nextDay = d.toISOString().slice(0, 10);
  return { start: { date }, end: { date: nextDay } };
}

function firstName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length >= 3 ? parts.slice(0, -1).join(" ") : full.trim();
}

/** Format date like "Mon 02/06" for display in descriptions */
function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${days[d.getUTCDay()]} ${dd}/${mm}`;
}

// ── Student roster computation ────────────────────────────────────────────────

type StudentCategory = {
  expected: string[];
  trial: string[];
  makeup: string[];
  waived: string[];
  absentNotified: string[];
};

async function computeStudentCategories(
  db: ReturnType<typeof getDb>,
  classId: string,
  sessionId: string,
  scheduledDate: string,
  studentNames: Map<string, string>,
  trialNames: Map<string, string>,
): Promise<StudentCategory> {
  // Enrolled roster for this class on this date
  const allRosterRows = await db
    .select({
      classId: enrollments.classId,
      studentId: enrollments.studentId,
      freeTrial: enrollments.freeTrial,
      enrollmentStartedAt: enrollments.startedAt,
      trialAttendedAt: enrollments.trialAttendedAt,
      enrollmentEndedAt: enrollments.endedAt,
      pauseStartedAt: enrollments.pauseStartedAt,
      pauseEndedAt: enrollments.pauseEndedAt,
      studentStartDate: students.startDate,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(and(eq(enrollments.classId, classId)));

  const roster = rosterForClassOnDate(allRosterRows, classId, scheduledDate);
  const rosterIds = new Set(roster.map((r) => r.studentId));

  // Attendance records for this session
  const records = await db
    .select({
      studentId: attendanceRecords.studentId,
      status: attendanceRecords.status,
      makeupNote: attendanceRecords.makeupNote,
    })
    .from(attendanceRecords)
    .where(eq(attendanceRecords.sessionId, sessionId));

  const recordMap = new Map(records.map((r) => [r.studentId, r]));
  const waiveSet = new Set(records.filter((r) => r.status === "waive").map((r) => r.studentId));

  const result: StudentCategory = {
    expected: [],
    trial: [],
    makeup: [],
    waived: [],
    absentNotified: [],
  };

  for (const r of roster) {
    const name = studentNames.get(r.studentId) ?? r.studentId;
    const rec = recordMap.get(r.studentId);
    const status = rec?.status ?? "absent_pending";
    const makeupNote = rec?.makeupNote ?? "";

    if (isWaivedOnSession(r.studentId, waiveSet, status as never)) {
      result.waived.push(name);
      continue;
    }

    if (status === "absent_notified") {
      result.absentNotified.push(name);
      continue;
    }

    // Missed this session; makeup booked on a different date
    if (isMissedLessonWithScheduledMakeup(scheduledDate, status as never, makeupNote)) {
      result.absentNotified.push(name);
      continue;
    }

    // Trial day
    if (r.trialAttendedAt && r.trialAttendedAt.slice(0, 10) === scheduledDate) {
      result.trial.push(name);
      continue;
    }

    // M/U visitor
    if (isMuLessonAttendee(scheduledDate, status as never, makeupNote)) {
      result.makeup.push(name);
      continue;
    }

    if (r.freeTrial) {
      result.trial.push(`${name} (free trial)`);
    } else {
      result.expected.push(name);
    }
  }

  // M/U visitors not on roster (non-enrolled makeup attendees)
  for (const rec of records) {
    if (!rosterIds.has(rec.studentId)) {
      if (isMuLessonAttendee(scheduledDate, rec.status as never, rec.makeupNote ?? "")) {
        const name = studentNames.get(rec.studentId) ?? rec.studentId;
        result.makeup.push(name);
      }
    }
  }

  return result;
}

function buildSessionDescription(
  categories: StudentCategory,
  originalDate: string | null,
): string {
  const lines: string[] = [];

  const fmt = (label: string, names: string[]) => {
    if (names.length === 0) return `${label} (0)`;
    return `${label} (${names.length}): ${names.map(firstName).join(", ")}`;
  };

  lines.push(fmt("Expected", categories.expected));
  lines.push(fmt("Trial", categories.trial));
  lines.push(fmt("M/U", categories.makeup));
  lines.push(fmt("Waived", categories.waived));
  if (categories.absentNotified.length > 0) {
    lines.push(fmt("Absent notified", categories.absentNotified));
  }

  if (originalDate) {
    lines.push("");
    lines.push(`Rescheduled from ${shortDate(originalDate)}`);
  }

  return lines.join("\n");
}

// ── Main sync function ────────────────────────────────────────────────────────

export async function syncToGoogleCalendar(dryRun = false): Promise<SyncResult> {
  const result: SyncResult = {
    sessions: { synced: 0, errors: 0 },
    events: { synced: 0, errors: 0 },
    shifts: { synced: 0, errors: 0 },
    holidaySessions: { synced: 0, errors: 0 },
    orphansDeleted: 0,
    dryRun,
  };

  const windowStart = sgtToday();
  const windowEnd = sgtDatePlus(90);
  const db = getDb();

  // Pre-fetch tutor emails: tutorMatch (uppercase name) → email
  const allowlistRows = await db
    .select({ email: siteAllowlist.email, tutorMatch: siteAllowlist.tutorMatch })
    .from(siteAllowlist);
  const tutorEmailByMatch = new Map<string, string>();
  for (const r of allowlistRows) {
    if (r.tutorMatch) tutorEmailByMatch.set(r.tutorMatch.toUpperCase(), r.email);
  }

  // ── 1. Class sessions ─────────────────────────────────────────────────────

  const sessionRows = await db
    .select({
      sessionId: classSessions.id,
      scheduledDate: classSessions.scheduledDate,
      timeLabel: classSessions.timeLabel,
      status: classSessions.status,
      originalDate: classSessions.originalDate,
      gcalEventId: classSessions.gcalEventId,
      classId: classes.id,
      label: classes.label,
      time: classes.time,
      classroom: classes.classroom,
      tutor: classes.tutor,
      reliefTutor: classSessions.reliefTutor,
    })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(
      and(
        gte(classSessions.scheduledDate, windowStart),
        lte(classSessions.scheduledDate, windowEnd),
      ),
    );

  // Pre-fetch all student names for these sessions in one query
  const allClassIds = [...new Set(sessionRows.map((r) => r.classId))];
  const allSessionIds = sessionRows.map((r) => r.sessionId);

  const studentRows =
    allClassIds.length > 0
      ? await db
          .select({ id: students.id, name: students.name })
          .from(students)
          .innerJoin(enrollments, eq(enrollments.studentId, students.id))
          .where(inArray(enrollments.classId, allClassIds))
      : [];
  const studentNames = new Map(studentRows.map((r) => [r.id, r.name]));

  // Also pre-fetch students referenced in attendance records (M/U visitors)
  if (allSessionIds.length > 0) {
    const attendeeRows = await db
      .select({ id: students.id, name: students.name })
      .from(students)
      .innerJoin(attendanceRecords, eq(attendanceRecords.studentId, students.id))
      .where(inArray(attendanceRecords.sessionId, allSessionIds));
    for (const r of attendeeRows) {
      if (!studentNames.has(r.id)) studentNames.set(r.id, r.name);
    }
  }

  for (const row of sessionRows) {
    try {
      // For rescheduled sessions (originalDate set), the timeLabel reflects the new time.
      // For regular sessions, cls.time is authoritative — session.timeLabel can be stale.
      const timeRaw = (row.originalDate ? row.timeLabel : null) || row.time || row.timeLabel;
      const parsed = parseTimeRange(timeRaw);
      if (!parsed) continue;

      const { start, end } = buildDateTimePayload(
        row.scheduledDate,
        parsed.startH,
        parsed.startM,
        parsed.endH,
        parsed.endM,
      );

      // Trial names for this session
      const trialRows = await db
        .select({ id: trialLeads.id, name: trialLeads.name })
        .from(trialLeads)
        .where(
          and(
            eq(trialLeads.classId, row.classId),
            eq(trialLeads.trialDate, row.scheduledDate),
            inArray(trialLeads.status, ["active", "converted", "declined"]),
          ),
        );
      const trialNames = new Map(trialRows.map((r) => [r.id, r.name]));
      // Add trial lead names to studentNames for M/U visitor lookup fallback
      for (const [id, name] of trialNames) studentNames.set(id, name);

      const isCancelled =
        row.status === "cancelled" || row.status === "rescheduled_away";

      // Always compute categories — needed to decide whether to skip, even for cancelled sessions.
      const categories = await computeStudentCategories(
        db,
        row.classId,
        row.sessionId,
        row.scheduledDate,
        studentNames,
        trialNames,
      );

      // Add trial leads to trial list
      for (const [, name] of trialNames) {
        if (!categories.trial.includes(name)) categories.trial.push(name);
      }

      // Skip sessions with no enrollments at all (including cancelled empty classes)
      const hasAnyStudents =
        categories.expected.length +
          categories.trial.length +
          categories.makeup.length +
          categories.waived.length +
          categories.absentNotified.length >
        0;

      if (!hasAnyStudents) {
        if (!dryRun && row.gcalEventId) {
          await deleteCalendarEvent(row.gcalEventId);
          await db
            .update(classSessions)
            .set({ gcalEventId: null })
            .where(eq(classSessions.id, row.sessionId));
        }
        continue;
      }

      let title = row.label;
      if (row.reliefTutor) {
        title += ` — ${row.reliefTutor} (Relief)`;
      } else if (row.tutor) {
        title += ` — ${row.tutor}`;
      }
      if (isCancelled) {
        title = `[CANCELLED] ${title}`;
      } else if (categories.expected.length === 0 && categories.trial.length === 0) {
        // All enrolled students are waived or doing makeup
        title = `[NO STUDENTS] ${title}`;
      }

      const description = isCancelled
        ? "Class cancelled."
        : buildSessionDescription(categories, row.originalDate ?? null);

      const sessionAttendees = [
        row.tutor ? tutorEmailByMatch.get(row.tutor.toUpperCase()) : undefined,
        row.reliefTutor ? tutorEmailByMatch.get(row.reliefTutor.toUpperCase()) : undefined,
      ].filter((e): e is string => Boolean(e));

      const payload: GCalEventPayload = {
        summary: title,
        description,
        location: row.classroom ? row.classroom.toUpperCase() : undefined,
        start,
        end,
        komSource: "class_session",
        komId: row.sessionId,
        attendees: sessionAttendees.length > 0 ? sessionAttendees : undefined,
      };

      if (!dryRun) {
        const gcalId = await upsertCalendarEvent(row.gcalEventId ?? null, payload);
        if (!row.gcalEventId || row.gcalEventId !== gcalId) {
          await db
            .update(classSessions)
            .set({ gcalEventId: gcalId })
            .where(eq(classSessions.id, row.sessionId));
        }
      }
      result.sessions.synced++;
    } catch (err) {
      console.error(`[gcal-sync] session ${row.sessionId}`, err);
      result.sessions.errors++;
    }
  }

  // ── 2. Calendar events ────────────────────────────────────────────────────

  const eventRows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        gte(calendarEvents.eventDate, windowStart),
        lte(calendarEvents.eventDate, windowEnd),
      ),
    );

  for (const ev of eventRows) {
    try {
      let timePart: { start: GCalEventPayload["start"]; end: GCalEventPayload["end"] };
      const parsed = ev.startTime && ev.endTime
        ? parseTimeRange(`${ev.startTime}–${ev.endTime}`)
        : null;

      if (parsed) {
        timePart = buildDateTimePayload(
          ev.eventDate,
          parsed.startH,
          parsed.startM,
          parsed.endH,
          parsed.endM,
        );
      } else if (ev.startTime) {
        // HH:MM format — parse directly
        const [sh, sm] = ev.startTime.split(":").map(Number);
        const [eh, em] = ev.endTime ? ev.endTime.split(":").map(Number) : [sh + 1, sm];
        timePart = buildDateTimePayload(ev.eventDate, sh, sm, eh, em);
      } else {
        timePart = buildAllDayPayload(ev.eventDate);
      }

      const payload: GCalEventPayload = {
        summary: ev.title,
        description: ev.notes || "",
        start: timePart.start,
        end: timePart.end,
        komSource: "calendar_event",
        komId: ev.id,
      };

      if (!dryRun) {
        const gcalId = await upsertCalendarEvent(ev.gcalEventId ?? null, payload);
        if (!ev.gcalEventId || ev.gcalEventId !== gcalId) {
          await db
            .update(calendarEvents)
            .set({ gcalEventId: gcalId })
            .where(eq(calendarEvents.id, ev.id));
        }
      }
      result.events.synced++;
    } catch (err) {
      console.error(`[gcal-sync] calendar_event ${ev.id}`, err);
      result.events.errors++;
    }
  }

  // ── 3. Admin roster shifts ────────────────────────────────────────────────

  const shiftRows = await db
    .select()
    .from(adminRosterShift)
    .where(
      and(
        gte(adminRosterShift.shiftDate, windowStart),
        lte(adminRosterShift.shiftDate, windowEnd),
        eq(adminRosterShift.published, true),
      ),
    );

  for (const shift of shiftRows) {
    try {
      const [sh, sm] = shift.startTime.split(":").map(Number);
      const [eh, em] = shift.endTime.split(":").map(Number);
      const { start, end } = buildDateTimePayload(shift.shiftDate, sh, sm, eh, em);

      const payload: GCalEventPayload = {
        summary: `Admin: ${shift.staffName || shift.staffEmail}`,
        description: "",
        start,
        end,
        komSource: "admin_shift",
        komId: shift.id,
        attendees: [shift.staffEmail],
      };

      if (!dryRun) {
        const gcalId = await upsertCalendarEvent(shift.gcalEventId ?? null, payload);
        if (!shift.gcalEventId || shift.gcalEventId !== gcalId) {
          await db
            .update(adminRosterShift)
            .set({ gcalEventId: gcalId })
            .where(eq(adminRosterShift.id, shift.id));
        }
      }
      result.shifts.synced++;
    } catch (err) {
      console.error(`[gcal-sync] admin_shift ${shift.id}`, err);
      result.shifts.errors++;
    }
  }

  // ── 4. Holiday programme sessions ─────────────────────────────────────────

  const hpSessionRows = await db
    .select({
      sessionId: holidayProgrammeSessions.id,
      programmeId: holidayProgrammeSessions.programmeId,
      scheduledDate: holidayProgrammeSessions.scheduledDate,
      timeLabel: holidayProgrammeSessions.timeLabel,
      tutorName: holidayProgrammeSessions.tutorName,
      gcalEventId: holidayProgrammeSessions.gcalEventId,
      programmeName: holidayProgrammes.name,
    })
    .from(holidayProgrammeSessions)
    .innerJoin(holidayProgrammes, eq(holidayProgrammeSessions.programmeId, holidayProgrammes.id))
    .where(
      and(
        gte(holidayProgrammeSessions.scheduledDate, windowStart),
        lte(holidayProgrammeSessions.scheduledDate, windowEnd),
        eq(holidayProgrammes.isActive, true),
      ),
    );

  const allProgrammeIds = [...new Set(hpSessionRows.map((r) => r.programmeId))];

  const participantRows =
    allProgrammeIds.length > 0
      ? await db
          .select({
            programmeId: holidayProgrammeParticipants.programmeId,
            id: holidayProgrammeParticipants.id,
            name: holidayProgrammeParticipants.name,
            studentId: holidayProgrammeParticipants.studentId,
          })
          .from(holidayProgrammeParticipants)
          .where(
            and(
              inArray(holidayProgrammeParticipants.programmeId, allProgrammeIds),
              inArray(holidayProgrammeParticipants.status, ["active", "converted"]),
            ),
          )
      : [];

  const participantsByProgramme = new Map<
    string,
    { id: string; name: string; studentId: string | null }[]
  >();
  for (const p of participantRows) {
    const list = participantsByProgramme.get(p.programmeId) ?? [];
    list.push({ id: p.id, name: p.name, studentId: p.studentId });
    participantsByProgramme.set(p.programmeId, list);
  }

  const allHpSessionIds = hpSessionRows.map((r) => r.sessionId);
  const hpWaivedRows =
    allHpSessionIds.length > 0
      ? await db
          .select({
            sessionId: holidayProgrammeAttendance.sessionId,
            participantId: holidayProgrammeAttendance.participantId,
          })
          .from(holidayProgrammeAttendance)
          .where(
            and(
              inArray(holidayProgrammeAttendance.sessionId, allHpSessionIds),
              eq(holidayProgrammeAttendance.status, "waive"),
            ),
          )
      : [];

  const waivedBySession = new Map<string, Set<string>>();
  for (const r of hpWaivedRows) {
    const set = waivedBySession.get(r.sessionId) ?? new Set<string>();
    set.add(r.participantId);
    waivedBySession.set(r.sessionId, set);
  }

  for (const row of hpSessionRows) {
    try {
      const parsed = parseTimeRange(row.timeLabel);
      if (!parsed) continue;

      const { start, end } = buildDateTimePayload(
        row.scheduledDate,
        parsed.startH,
        parsed.startM,
        parsed.endH,
        parsed.endM,
      );

      const participants = participantsByProgramme.get(row.programmeId) ?? [];
      const waived = waivedBySession.get(row.sessionId) ?? new Set<string>();

      const fmt = (label: string, names: string[]) =>
        names.length === 0 ? `${label} (0)` : `${label} (${names.length}): ${names.map(firstName).join(", ")}`;

      const newNames = participants.filter((p) => !waived.has(p.id) && p.studentId === null).map((p) => p.name);
      const existingNames = participants.filter((p) => !waived.has(p.id) && p.studentId !== null).map((p) => p.name);
      const waivedNames = participants.filter((p) => waived.has(p.id)).map((p) => p.name);

      const title = row.tutorName
        ? `${row.programmeName} — ${row.tutorName}`
        : row.programmeName;
      const description = [
        fmt("New", newNames),
        fmt("Existing", existingNames),
        fmt("Absent notified", waivedNames),
      ].join("\n");

      const hpTutorEmail = row.tutorName
        ? tutorEmailByMatch.get(row.tutorName.toUpperCase())
        : undefined;

      const payload: GCalEventPayload = {
        summary: title,
        description,
        start,
        end,
        komSource: "holiday_session",
        komId: row.sessionId,
        attendees: hpTutorEmail ? [hpTutorEmail] : undefined,
      };

      if (!dryRun) {
        const gcalId = await upsertCalendarEvent(row.gcalEventId ?? null, payload);
        if (!row.gcalEventId || row.gcalEventId !== gcalId) {
          await db
            .update(holidayProgrammeSessions)
            .set({ gcalEventId: gcalId })
            .where(eq(holidayProgrammeSessions.id, row.sessionId));
        }
      }
      result.holidaySessions.synced++;
    } catch (err) {
      console.error(`[gcal-sync] holiday_session ${row.sessionId}`, err);
      result.holidaySessions.errors++;
    }
  }

  // ── 5. Orphan cleanup ─────────────────────────────────────────────────────

  if (!dryRun) {
    try {
      // Look back 30 days so recently-deleted past sessions are also cleaned up
      const timeMin = new Date(sgtDatePlus(-30) + "T00:00:00+08:00").toISOString();
      const timeMax = new Date(windowEnd + "T23:59:59+08:00").toISOString();
      const gcalEvents = await listKomEvents(timeMin, timeMax);

      const sessionIdSet = new Set(sessionRows.map((r) => r.sessionId));
      const eventIdSet = new Set(eventRows.map((r) => r.id));
      const shiftIdSet = new Set(shiftRows.map((r) => r.id));
      const hpSessionIdSet = new Set(hpSessionRows.map((r) => r.sessionId));

      for (const ev of gcalEvents) {
        let orphan = false;
        if (ev.komSource === "class_session" && !sessionIdSet.has(ev.komId)) orphan = true;
        if (ev.komSource === "calendar_event" && !eventIdSet.has(ev.komId)) orphan = true;
        if (ev.komSource === "admin_shift" && !shiftIdSet.has(ev.komId)) orphan = true;
        if (ev.komSource === "holiday_session" && !hpSessionIdSet.has(ev.komId)) orphan = true;
        if (orphan) {
          await deleteCalendarEvent(ev.gcalEventId);
          result.orphansDeleted++;
        }
      }
    } catch (err) {
      console.error("[gcal-sync] orphan cleanup failed", err);
    }
  }

  return result;
}
