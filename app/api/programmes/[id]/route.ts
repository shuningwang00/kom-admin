import { assertCanManageStudents, assertCanReadRoster } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { holidayProgrammes } from "@/lib/db/schema";
import {
  getProgrammeById,
  listProgrammeParticipants,
  listProgrammeSessions,
} from "@/lib/programmes/list";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanReadRoster();
    const { id } = await params;

    const [programme, sessions, participants] = await Promise.all([
      getProgrammeById(id),
      listProgrammeSessions(id),
      listProgrammeParticipants(id),
    ]);

    if (!programme) return jsonError("Programme not found.", 404);

    return jsonOk({ programme, sessions, participants });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanManageStudents();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const updates: Partial<typeof holidayProgrammes.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name != null) updates.name = String(body.name).trim();
    if (body.isActive != null) updates.isActive = Boolean(body.isActive);

    const db = getDb();
    const [updated] = await db
      .update(holidayProgrammes)
      .set(updates)
      .where(eq(holidayProgrammes.id, id))
      .returning();

    if (!updated) return jsonError("Programme not found.", 404);
    return jsonOk({ programme: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanManageStudents();
    const { id } = await params;
    const db = getDb();
    await db.delete(holidayProgrammes).where(eq(holidayProgrammes.id, id));
    return jsonOk({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}
