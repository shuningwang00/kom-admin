import { assertCanManageStudents } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { holidayProgrammeParticipants } from "@/lib/db/schema";
import { convertProgrammeParticipant } from "@/lib/programmes/convert";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; participantId: string }> },
) {
  try {
    await assertCanManageStudents();
    const { participantId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const db = getDb();
    const [participant] = await db
      .select()
      .from(holidayProgrammeParticipants)
      .where(eq(holidayProgrammeParticipants.id, participantId))
      .limit(1);

    if (!participant) return jsonError("Participant not found.", 404);

    const result = await convertProgrammeParticipant(db, participant, {
      startDate: body.startDate != null ? String(body.startDate) : undefined,
      classId: body.classId != null ? String(body.classId) : undefined,
      registrationFeeDue: Boolean(body.registrationFeeDue),
    });

    return jsonOk(result, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("already") || message.includes("required")
          ? 400
          : message.includes("DATABASE_URL")
            ? 503
            : 500;
    return jsonError(message, status);
  }
}
