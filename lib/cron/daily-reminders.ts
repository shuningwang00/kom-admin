import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/lib/db/index";
import {
  adminRosterShift,
  attendanceRecords,
  calendarEvents,
  classes,
  classSessions,
  enrollments,
  holidayProgrammeAttendance,
  holidayProgrammeParticipants,
  holidayProgrammes,
  holidayProgrammeSessions,
  siteAllowlist,
  trialLeads,
} from "@/lib/db/schema";
import { listAllScheduledMakeupsEver } from "@/lib/attendance/makeup-booking";
import { listNeedsMakeupScheduling, listReliefTutorNeededSessions } from "@/lib/attendance/makeup-hub";
import { formatClassDropdownLabel, formatClassTypeLabel } from "@/lib/classes/display-label";
import { sendTelegramMessage } from "@/lib/telegram/send";


/** Current date in SGT (UTC+8), offset by days. */
function sgtDate(offsetDays = 0): string {
  const now = new Date();
  const d = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function fmtDisplayDate(iso: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const d = new Date(iso + "T00:00:00Z");
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

function fmtShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function fmt12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h)) return hhmm;
  const hour = h % 12 || 12;
  const mer = h >= 12 ? "pm" : "am";
  return m ? `${hour}:${String(m).padStart(2, "0")}${mer}` : `${hour}${mer}`;
}

function fmtTimeLabel(label: string): string {
  return label.replace(/(\d{1,2}:\d{2})/g, (t) => fmt12h(t));
}

export async function buildDailyReminder(): Promise<string> {
  const db = getDb();
  const tomorrow = sgtDate(1);

  // ── 1. Admin on duty tomorrow ─────────────────────────────────────────────
  const shifts = await db
    .select({ staffEmail: adminRosterShift.staffEmail, staffName: adminRosterShift.staffName, startTime: adminRosterShift.startTime, endTime: adminRosterShift.endTime })
    .from(adminRosterShift)
    .where(and(eq(adminRosterShift.shiftDate, tomorrow), eq(adminRosterShift.published, true)));

  const dutyEmails = [...new Set(shifts.map((s) => s.staffEmail))];

  let mentionLine: string;
  if (dutyEmails.length > 0) {
    const allowlistRows = await db
      .select({ email: siteAllowlist.email, displayName: siteAllowlist.displayName, telegramHandle: siteAllowlist.telegramHandle })
      .from(siteAllowlist)
      .where(inArray(siteAllowlist.email, dutyEmails));

    const shiftTimeByEmail = new Map<string, string>();
    for (const s of shifts) {
      const t = `${fmt12h(s.startTime)} – ${fmt12h(s.endTime)}`;
      shiftTimeByEmail.set(s.staffEmail, t);
    }

    const handles = allowlistRows
      .filter((r) => r.telegramHandle)
      .map((r) => `@${r.telegramHandle}`);
    if (handles.length > 0) {
      const shiftTime = allowlistRows
        .filter((r) => r.telegramHandle)
        .map((r) => shiftTimeByEmail.get(r.email))
        .find(Boolean);
      mentionLine = `Heads up ${handles.join(", ")} — you're on duty tomorrow${shiftTime ? ` (${shiftTime})` : ""}.`;
    } else {
      const names = shifts.map((s) => s.staffName || s.staffEmail.split("@")[0]);
      const shiftTime = shifts.length ? `${fmt12h(shifts[0].startTime)} – ${fmt12h(shifts[0].endTime)}` : "";
      mentionLine = `Heads up ${[...new Set(names)].join(", ")} — you're on duty tomorrow${shiftTime ? ` (${shiftTime})` : ""}.`;
    }
  } else {
    mentionLine = `No admin on duty tomorrow.`;
  }

  // ── 2. Class sessions tomorrow with attendance counts ─────────────────────
  const sessionRows = await db
    .select({ session: classSessions, class: classes })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(and(eq(classSessions.scheduledDate, tomorrow), eq(classSessions.status, "scheduled")));

  // Fetch all makeups once — used in sessions section and upcoming section
  const allMakeups = await listAllScheduledMakeupsEver();

  let sessionsSection = "";
  if (sessionRows.length > 0) {
    const sessionClassIds = sessionRows.map((r) => r.class.id);
    const sessionIds = sessionRows.map((r) => r.session.id);

    // Active enrollments per class
    const enrollmentRows = await db
      .select({ classId: enrollments.classId, pauseStartedAt: enrollments.pauseStartedAt, pauseEndedAt: enrollments.pauseEndedAt })
      .from(enrollments)
      .where(
        and(
          inArray(enrollments.classId, sessionClassIds),
          isNull(enrollments.endedAt),
          lte(enrollments.startedAt, tomorrow),
        ),
      );

    // Count active (not currently paused) per classId
    const enrolledCount = new Map<string, number>();
    for (const e of enrollmentRows) {
      const paused =
        e.pauseStartedAt &&
        e.pauseStartedAt <= tomorrow &&
        (!e.pauseEndedAt || e.pauseEndedAt >= tomorrow);
      if (!paused) {
        enrolledCount.set(e.classId, (enrolledCount.get(e.classId) ?? 0) + 1);
      }
    }

    // Trials per classId
    const trialRows = await db
      .select({ classId: trialLeads.classId })
      .from(trialLeads)
      .where(and(eq(trialLeads.trialDate, tomorrow), eq(trialLeads.status, "active")));
    const trialCount = new Map<string, number>();
    for (const t of trialRows) {
      if (t.classId) trialCount.set(t.classId, (trialCount.get(t.classId) ?? 0) + 1);
    }

    // Makeups per session tomorrow
    const makeupCount = new Map<string, number>();
    for (const m of allMakeups) {
      if (m.makeupDate === tomorrow && !m.isComplete) {
        makeupCount.set(m.targetSessionId, (makeupCount.get(m.targetSessionId) ?? 0) + 1);
      }
    }

    // Waived per session (attendance records may not exist yet)
    const waivedRows = sessionIds.length
      ? await db
          .select({ sessionId: attendanceRecords.sessionId })
          .from(attendanceRecords)
          .where(and(inArray(attendanceRecords.sessionId, sessionIds), eq(attendanceRecords.status, "waive")))
      : [];
    const waivedCount = new Map<string, number>();
    for (const w of waivedRows) {
      waivedCount.set(w.sessionId, (waivedCount.get(w.sessionId) ?? 0) + 1);
    }

    const lines = sessionRows
      .filter(({ class: cls }) => (enrolledCount.get(cls.id) ?? 0) > 0)
      .map(({ session, class: cls }) => {
        const type = formatClassTypeLabel(cls);
        const timePart = cls.time.trim();
        const labelParts = [type];
        if (timePart) labelParts.push(timePart);
        if (session.reliefTutor) {
          labelParts.push(`${session.reliefTutor} (relief)`);
        } else if (cls.tutor) {
          labelParts.push(cls.tutor);
        }
        const header = labelParts.join(" · ");

        const enrolled = enrolledCount.get(cls.id) ?? 0;
        const trials = trialCount.get(cls.id) ?? 0;
        const makeups = makeupCount.get(session.id) ?? 0;
        const waived = waivedCount.get(session.id) ?? 0;

        let counts = "";
        if (waived >= enrolled && trials === 0 && makeups === 0) {
          counts = `\n    ⚠️ Class cancelled, all students waived/makeup`;
        } else {
          const attendParts: string[] = [];
          if (enrolled > 0) attendParts.push(`${enrolled} student${enrolled > 1 ? "s" : ""}`);
          if (trials > 0) attendParts.push(`${trials} trial${trials > 1 ? "s" : ""}`);
          if (makeups > 0) attendParts.push(`${makeups} M/U`);
          const base = attendParts.join(" + ");
          counts = `\n    ${base}${waived > 0 ? ` · ${waived} waived` : ""}`;
        }
        return `  • ${header}${counts}`;
      });

    if (lines.length > 0) {
      sessionsSection = `\n📚 <b>Classes (${lines.length})</b>\n${lines.join("\n")}`;
    }
  }

  // ── 3. Upcoming trials (today onwards) ───────────────────────────────────
  const today = sgtDate(0);
  const namedTrials = await db
    .select({ name: trialLeads.name, classId: trialLeads.classId, trialDate: trialLeads.trialDate })
    .from(trialLeads)
    .where(and(gte(trialLeads.trialDate, today), eq(trialLeads.status, "active")))
    .orderBy(asc(trialLeads.trialDate));

  const trialClassIds = namedTrials.map((t) => t.classId).filter(Boolean) as string[];
  const trialClassRows = trialClassIds.length ? await db.select().from(classes).where(inArray(classes.id, trialClassIds)) : [];
  const trialClassMap = new Map(trialClassRows.map((c) => [c.id, c]));
  const trialLines = namedTrials.map((t) => {
    const cls = t.classId ? trialClassMap.get(t.classId) : null;
    const dateTag = t.trialDate ? ` · ${fmtDisplayDate(t.trialDate)}` : "";
    const typeTag = cls ? ` · ${formatClassTypeLabel(cls)}` : "";
    const tutorTag = cls?.tutor?.trim() ? ` · ${cls.tutor.trim()}` : "";
    return `  • ${t.name}${dateTag}${typeTag}${tutorTag}`;
  });

  // ── 4. HOL programme sessions tomorrow ───────────────────────────────────
  const holRows = await db
    .select({
      sessionId: holidayProgrammeSessions.id,
      programmeId: holidayProgrammeSessions.programmeId,
      programmeName: holidayProgrammes.name,
      timeLabel: holidayProgrammeSessions.timeLabel,
      tutorName: holidayProgrammeSessions.tutorName,
    })
    .from(holidayProgrammeSessions)
    .innerJoin(holidayProgrammes, eq(holidayProgrammeSessions.programmeId, holidayProgrammes.id))
    .where(eq(holidayProgrammeSessions.scheduledDate, tomorrow));

  let holSection = "";
  if (holRows.length > 0) {
    const holProgrammeIds = holRows.map((h) => h.programmeId);
    const holSessionIds = holRows.map((h) => h.sessionId);

    // Participants per programme (existing = has studentId, new = no studentId)
    const holParticipants = await db
      .select({ programmeId: holidayProgrammeParticipants.programmeId, studentId: holidayProgrammeParticipants.studentId })
      .from(holidayProgrammeParticipants)
      .where(and(inArray(holidayProgrammeParticipants.programmeId, holProgrammeIds), eq(holidayProgrammeParticipants.status, "active")));

    const holExisting = new Map<string, number>();
    const holNew = new Map<string, number>();
    for (const p of holParticipants) {
      if (p.studentId) {
        holExisting.set(p.programmeId, (holExisting.get(p.programmeId) ?? 0) + 1);
      } else {
        holNew.set(p.programmeId, (holNew.get(p.programmeId) ?? 0) + 1);
      }
    }

    // Waived per session
    const holWaivedRows = await db
      .select({ sessionId: holidayProgrammeAttendance.sessionId })
      .from(holidayProgrammeAttendance)
      .where(and(inArray(holidayProgrammeAttendance.sessionId, holSessionIds), eq(holidayProgrammeAttendance.status, "waive")));
    const holWaived = new Map<string, number>();
    for (const w of holWaivedRows) {
      holWaived.set(w.sessionId, (holWaived.get(w.sessionId) ?? 0) + 1);
    }

    const lines = holRows.map((h) => {
      const parts = [h.programmeName];
      if (h.timeLabel) parts.push(fmtTimeLabel(h.timeLabel));
      if (h.tutorName) parts.push(h.tutorName);
      const header = parts.join(" · ");

      const attendParts: string[] = [];
      const existing = holExisting.get(h.programmeId) ?? 0;
      if (existing > 0) attendParts.push(`${existing} existing`);
      const newStudents = holNew.get(h.programmeId) ?? 0;
      if (newStudents > 0) attendParts.push(`${newStudents} new`);
      const waived = holWaived.get(h.sessionId) ?? 0;

      let counts = "";
      if (attendParts.length > 0 || waived > 0) {
        const base = attendParts.join(" + ");
        counts = `\n    ${base}${waived > 0 ? ` · ${waived} waived` : ""}`;
      }
      return `  • ${header}${counts}`;
    });
    holSection = `\n🎓 <b>Holiday programme (${holRows.length})</b>\n${lines.join("\n")}`;
  }

  // ── 5. Action needed + Upcoming ───────────────────────────────────────────
  const [needs, reliefNeeded] = await Promise.all([
    listNeedsMakeupScheduling(),
    listReliefTutorNeededSessions(),
  ]);

  const actionParts: string[] = [];
  if (needs.length > 0) {
    const lines = needs.map((n) => `  • ${n.studentName} · ${n.programmeType} · missed ${fmtShortDate(n.missedDate)}`);
    actionParts.push(`<b>Make-up to be scheduled (${needs.length})</b>\n${lines.join("\n")}`);
  }
  if (reliefNeeded.length > 0) {
    const lines = reliefNeeded.map((r) => `  • ${r.typeLabel} · ${fmtDisplayDate(r.scheduledDate)} · ${r.regularTutor}`);
    actionParts.push(`<b>Relief needed (${reliefNeeded.length})</b>\n${lines.join("\n")}`);
  }
  const actionSection = actionParts.length
    ? `\n🏃 <b>Action needed</b>\n${actionParts.join("\n\n")}`
    : "";

  // Upcoming scheduled makeups (future, not yet complete)
  const upcomingMakeups = allMakeups.filter((m) => m.makeupDate >= today && !m.isComplete);

  const upcomingParts: string[] = [];
  if (trialLines.length > 0) {
    upcomingParts.push(`<b>Trials (${trialLines.length})</b>\n${trialLines.join("\n")}`);
  }
  if (upcomingMakeups.length > 0) {
    const lines = upcomingMakeups.map((m) => `  • ${m.studentName} · ${fmtDisplayDate(m.makeupDate)} · ${m.makeupProgrammeType}`);
    upcomingParts.push(`<b>Make-up (${upcomingMakeups.length})</b>\n${lines.join("\n")}`);
  }
  const upcomingSection = upcomingParts.length
    ? `\n🗓  <b>Upcoming</b>\n${upcomingParts.join("\n\n")}`
    : "";

  // ── 6. Calendar events tomorrow ──────────────────────────────────────────
  const eventRows = await db
    .select({ title: calendarEvents.title, startTime: calendarEvents.startTime, endTime: calendarEvents.endTime })
    .from(calendarEvents)
    .where(eq(calendarEvents.eventDate, tomorrow))
    .orderBy(asc(calendarEvents.startTime));

  let eventsSection = "";
  if (eventRows.length > 0) {
    const lines = eventRows.map((e) => {
      const timing = e.startTime ? ` (${fmt12h(e.startTime)}${e.endTime ? ` – ${fmt12h(e.endTime)}` : ""})` : "";
      return `  • ${e.title}${timing}`;
    });
    eventsSection = `\n📌 <b>Others</b>\n${lines.join("\n")}`;
  }

  const nothingSection =
    sessionRows.length === 0 && holRows.length === 0
      ? "\n✅ Nothing scheduled for tomorrow."
      : "";

  return [
    `📅 <b>Daily digest</b>\n<b>Reminders for tomorrow – ${fmtDisplayDate(tomorrow)}</b>`,
    sessionsSection,
    holSection,
    nothingSection,
    eventsSection,
    actionSection,
    upcomingSection,
    "",
    mentionLine,
  ]
    .filter((s) => s !== "")
    .join("\n")
    .trim();
}

export async function sendDailyReminder(): Promise<void> {
  const message = await buildDailyReminder();
  await sendTelegramMessage(message);
}
