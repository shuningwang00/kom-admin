import { jsonError, jsonOk } from "@/lib/api/json";
import { isOwner, isStaff, requireEffectiveUser } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { calendarEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireEffectiveUser();
    if (!isOwner(user) && !isStaff(user)) {
      return jsonError("Staff or owner access required.", 403);
    }
    const { id } = await params;
    const body = (await request.json()) as {
      title?: string;
      eventDate?: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
    };
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) patch.title = body.title.trim();
    if (body.eventDate !== undefined) patch.eventDate = body.eventDate.trim();
    if (body.startTime !== undefined) patch.startTime = body.startTime.trim();
    if (body.endTime !== undefined) patch.endTime = body.endTime.trim();
    if (body.notes !== undefined) patch.notes = body.notes.trim();
    const [row] = await db
      .update(calendarEvents)
      .set(patch)
      .where(eq(calendarEvents.id, id))
      .returning();
    if (!row) return jsonError("Event not found.", 404);
    return jsonOk({ event: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireEffectiveUser();
    if (!isOwner(user) && !isStaff(user)) {
      return jsonError("Staff or owner access required.", 403);
    }
    const { id } = await params;
    const db = getDb();
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
    return jsonOk({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, 500);
  }
}
