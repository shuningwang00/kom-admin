import { assertCanManageStudents } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { holidayProgrammeParticipants } from "@/lib/db/schema";
import type { ContactType } from "@/lib/contacts";
import { CONTACT_TYPES } from "@/lib/contacts";
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
    if (body.name != null) updates.name = String(body.name).trim();
    if (body.level != null) updates.level = String(body.level).trim();
    if (body.primaryContact != null) updates.primaryContact = String(body.primaryContact).trim();
    if (body.primaryContactType != null) {
      const v = body.primaryContactType as string;
      updates.primaryContactType = (CONTACT_TYPES.includes(v as ContactType) ? v : null) as ContactType | null;
    }
    if (body.secondaryContact != null) updates.secondaryContact = String(body.secondaryContact).trim();
    if (body.secondaryContactType != null) {
      const v = body.secondaryContactType as string;
      updates.secondaryContactType = (CONTACT_TYPES.includes(v as ContactType) ? v : null) as ContactType | null;
    }
    if (body.parentName != null) updates.parentName = String(body.parentName).trim();
    if (body.school != null) updates.school = String(body.school).trim();
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
