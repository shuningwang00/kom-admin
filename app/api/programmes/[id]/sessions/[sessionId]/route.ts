import { assertCanManageStudents } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { holidayProgrammeSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  try {
    await assertCanManageStudents();
    const { sessionId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const updates: Partial<typeof holidayProgrammeSessions.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.scheduledDate != null)
      updates.scheduledDate = String(body.scheduledDate).trim();
    if (body.timeLabel != null)
      updates.timeLabel = String(body.timeLabel).trim();
    if (body.tutorName != null)
      updates.tutorName = String(body.tutorName).trim();
    if (body.notes != null) updates.notes = String(body.notes).trim();

    const db = getDb();
    const [updated] = await db
      .update(holidayProgrammeSessions)
      .set(updates)
      .where(eq(holidayProgrammeSessions.id, sessionId))
      .returning();

    if (!updated) return jsonError("Session not found.", 404);
    return jsonOk({ session: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  try {
    await assertCanManageStudents();
    const { sessionId } = await params;
    const db = getDb();
    await db
      .delete(holidayProgrammeSessions)
      .where(eq(holidayProgrammeSessions.id, sessionId));
    return jsonOk({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}
