import { assertCanReadRoster } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import {
  holidayProgrammeAttendance,
  holidayProgrammeParticipants,
  holidayProgrammes,
  holidayProgrammeSessions,
  students,
} from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanReadRoster();
    const { id } = await params;
    const db = getDb();

    const [sessionRow] = await db
      .select({ session: holidayProgrammeSessions, programme: holidayProgrammes })
      .from(holidayProgrammeSessions)
      .innerJoin(
        holidayProgrammes,
        eq(holidayProgrammeSessions.programmeId, holidayProgrammes.id),
      )
      .where(eq(holidayProgrammeSessions.id, id))
      .limit(1);

    if (!sessionRow) return jsonError("Session not found.", 404);

    const participantRows = await db
      .select({ participant: holidayProgrammeParticipants, studentName: students.name })
      .from(holidayProgrammeParticipants)
      .leftJoin(students, eq(holidayProgrammeParticipants.studentId, students.id))
      .where(eq(holidayProgrammeParticipants.programmeId, sessionRow.session.programmeId))
      .orderBy(asc(holidayProgrammeParticipants.createdAt));

    const attendanceRows = await db
      .select()
      .from(holidayProgrammeAttendance)
      .where(eq(holidayProgrammeAttendance.sessionId, id));

    const attendanceByParticipant = new Map(
      attendanceRows.map((a) => [a.participantId, a.status]),
    );

    const participants = participantRows.map(({ participant, studentName }) => ({
      id: participant.id,
      studentId: participant.studentId,
      name: participant.studentId ? (studentName ?? participant.name) : participant.name,
      fee: participant.fee,
      feePaid: participant.feePaid,
      attendanceStatus: attendanceByParticipant.get(participant.id) ?? "absent_pending",
      attendanceSaved: attendanceByParticipant.has(participant.id),
    }));

    return jsonOk({
      session: sessionRow.session,
      programme: sessionRow.programme,
      participants,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}
