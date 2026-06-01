import { getDb } from "@/lib/db/index";
import {
  holidayProgrammeAttendance,
  holidayProgrammeParticipants,
  holidayProgrammes,
  holidayProgrammeSessions,
  students,
} from "@/lib/db/schema";
import { asc, count, eq, inArray, min } from "drizzle-orm";

export type ProgrammeRow = typeof holidayProgrammes.$inferSelect;
export type ProgrammeSessionRow = typeof holidayProgrammeSessions.$inferSelect;
export type ProgrammeParticipantRow =
  typeof holidayProgrammeParticipants.$inferSelect & {
    studentName?: string | null;
  };
export type ProgrammeAttendanceRow =
  typeof holidayProgrammeAttendance.$inferSelect;

export type ProgrammeSummary = ProgrammeRow & {
  participantCount: number;
  firstSessionDate: string | null;
};

export async function listProgrammes(): Promise<ProgrammeSummary[]> {
  const db = getDb();
  const programmes = await db
    .select()
    .from(holidayProgrammes)
    .orderBy(asc(holidayProgrammes.name));

  if (programmes.length === 0) return [];

  const ids = programmes.map((p) => p.id);

  const [participantRows, sessionRows] = await Promise.all([
    db
      .select({
        programmeId: holidayProgrammeParticipants.programmeId,
        cnt: count(holidayProgrammeParticipants.id),
      })
      .from(holidayProgrammeParticipants)
      .where(inArray(holidayProgrammeParticipants.programmeId, ids))
      .groupBy(holidayProgrammeParticipants.programmeId),
    db
      .select({
        programmeId: holidayProgrammeSessions.programmeId,
        firstDate: min(holidayProgrammeSessions.scheduledDate),
      })
      .from(holidayProgrammeSessions)
      .where(inArray(holidayProgrammeSessions.programmeId, ids))
      .groupBy(holidayProgrammeSessions.programmeId),
  ]);

  const participantCounts = new Map(participantRows.map((r) => [r.programmeId, Number(r.cnt)]));
  const firstDates = new Map(sessionRows.map((r) => [r.programmeId, r.firstDate ?? null]));

  return programmes.map((p) => ({
    ...p,
    participantCount: participantCounts.get(p.id) ?? 0,
    firstSessionDate: firstDates.get(p.id) ?? null,
  }));
}

export async function getProgrammeById(
  id: string,
): Promise<ProgrammeRow | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(holidayProgrammes)
    .where(eq(holidayProgrammes.id, id))
    .limit(1);
  return row;
}

export async function listProgrammeSessions(
  programmeId: string,
): Promise<ProgrammeSessionRow[]> {
  const db = getDb();
  return db
    .select()
    .from(holidayProgrammeSessions)
    .where(eq(holidayProgrammeSessions.programmeId, programmeId))
    .orderBy(asc(holidayProgrammeSessions.scheduledDate));
}

export async function listProgrammeParticipants(
  programmeId: string,
): Promise<ProgrammeParticipantRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      participant: holidayProgrammeParticipants,
      studentName: students.name,
    })
    .from(holidayProgrammeParticipants)
    .leftJoin(
      students,
      eq(holidayProgrammeParticipants.studentId, students.id),
    )
    .where(eq(holidayProgrammeParticipants.programmeId, programmeId))
    .orderBy(asc(holidayProgrammeParticipants.createdAt));

  return rows.map(({ participant, studentName }) => ({
    ...participant,
    studentName,
  }));
}

export async function listHolSessionsForDate(date: string) {
  const db = getDb();
  const sessionRows = await db
    .select({ session: holidayProgrammeSessions, programme: holidayProgrammes })
    .from(holidayProgrammeSessions)
    .innerJoin(
      holidayProgrammes,
      eq(holidayProgrammeSessions.programmeId, holidayProgrammes.id),
    )
    .where(
      eq(holidayProgrammeSessions.scheduledDate, date),
    )
    .orderBy(asc(holidayProgrammeSessions.scheduledDate));

  if (sessionRows.length === 0) return [];

  const activeRows = sessionRows.filter((r) => r.programme.isActive);
  if (activeRows.length === 0) return [];

  const programmeIds = [...new Set(activeRows.map((r) => r.session.programmeId))];
  const sessionIds = activeRows.map((r) => r.session.id);

  const [participantRows, attendanceRows] = await Promise.all([
    db
      .select({
        id: holidayProgrammeParticipants.id,
        programmeId: holidayProgrammeParticipants.programmeId,
        studentId: holidayProgrammeParticipants.studentId,
      })
      .from(holidayProgrammeParticipants)
      .where(inArray(holidayProgrammeParticipants.programmeId, programmeIds)),
    db
      .select({
        sessionId: holidayProgrammeAttendance.sessionId,
        participantId: holidayProgrammeAttendance.participantId,
        status: holidayProgrammeAttendance.status,
      })
      .from(holidayProgrammeAttendance)
      .where(inArray(holidayProgrammeAttendance.sessionId, sessionIds)),
  ]);

  // sessionId -> Map<participantId, status>
  const attendanceBySession = new Map<string, Map<string, string>>();
  for (const a of attendanceRows) {
    if (!attendanceBySession.has(a.sessionId)) attendanceBySession.set(a.sessionId, new Map());
    attendanceBySession.get(a.sessionId)!.set(a.participantId, a.status as string);
  }

  // programmeId -> participants[]
  const participantsByProgramme = new Map<string, typeof participantRows>();
  for (const p of participantRows) {
    if (!participantsByProgramme.has(p.programmeId)) participantsByProgramme.set(p.programmeId, []);
    participantsByProgramme.get(p.programmeId)!.push(p);
  }

  return activeRows.map(({ session, programme }) => {
    const participants = participantsByProgramme.get(session.programmeId) ?? [];
    const sessionAttendance = attendanceBySession.get(session.id) ?? new Map<string, string>();
    let newCount = 0, existingCount = 0, waivedCount = 0;
    for (const p of participants) {
      if (sessionAttendance.get(p.id) === "waive") {
        waivedCount++;
      } else if (p.studentId) {
        existingCount++;
      } else {
        newCount++;
      }
    }
    return {
      sessionId: session.id,
      programmeId: session.programmeId,
      programmeName: programme.name,
      tutorName: session.tutorName,
      timeLabel: session.timeLabel,
      participantCount: participants.length,
      newCount,
      existingCount,
      waivedCount,
    };
  });
}

export async function listSessionAttendance(
  sessionId: string,
): Promise<ProgrammeAttendanceRow[]> {
  const db = getDb();
  return db
    .select()
    .from(holidayProgrammeAttendance)
    .where(eq(holidayProgrammeAttendance.sessionId, sessionId));
}
