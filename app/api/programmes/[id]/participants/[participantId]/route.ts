import { assertCanManageStudents } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { holidayProgrammeParticipants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; participantId: string }> },
) {
  try {
    await assertCanManageStudents();
    const { participantId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const updates: Partial<typeof holidayProgrammeParticipants.$inferInsert> =
      { updatedAt: new Date() };

    if (body.fee != null) updates.fee = String(body.fee).trim();
    if (body.feePaid != null) updates.feePaid = Boolean(body.feePaid);
    if (body.notes != null) updates.notes = String(body.notes).trim();

    const db = getDb();
    const [updated] = await db
      .update(holidayProgrammeParticipants)
      .set(updates)
      .where(eq(holidayProgrammeParticipants.id, participantId))
      .returning();

    if (!updated) return jsonError("Participant not found.", 404);
    return jsonOk({ participant: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}

export async function DELETE(
  _req: Request,
  {
    params,
  }: { params: Promise<{ id: string; participantId: string }> },
) {
  try {
    await assertCanManageStudents();
    const { participantId } = await params;
    const db = getDb();
    await db
      .delete(holidayProgrammeParticipants)
      .where(eq(holidayProgrammeParticipants.id, participantId));
    return jsonOk({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}
