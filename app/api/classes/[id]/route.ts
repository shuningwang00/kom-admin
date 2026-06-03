import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanMutateClasses } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { classes, weekdayEnum } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const WEEKDAYS = weekdayEnum.enumValues;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanMutateClasses();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const updates: Partial<typeof classes.$inferInsert> = {};
    if (typeof body.label === "string") updates.label = body.label.trim();
    if (typeof body.level === "string") updates.level = body.level.trim();
    if (typeof body.time === "string") updates.time = body.time.trim();
    if (typeof body.tutor === "string") updates.tutor = body.tutor.trim();
    if (typeof body.description === "string") updates.description = body.description.trim();
    if (typeof body.feePerLesson === "string") updates.feePerLesson = body.feePerLesson.trim();
    if (typeof body.isFull === "boolean") updates.isFull = body.isFull;
    if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
    if (typeof body.weekday === "string" && WEEKDAYS.includes(body.weekday as typeof WEEKDAYS[number])) {
      updates.weekday = body.weekday as typeof WEEKDAYS[number];
    }

    if (Object.keys(updates).length === 0) return jsonError("No fields to update.");

    updates.updatedAt = new Date();

    const db = getDb();
    const [updated] = await db
      .update(classes)
      .set(updates)
      .where(eq(classes.id, id))
      .returning();

    if (!updated) return jsonError("Class not found.", 404);
    return jsonOk({ class: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message.includes("owner") || message.includes("admin") ? 403 : 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanMutateClasses();
    const { id } = await params;
    const db = getDb();
    const [updated] = await db
      .update(classes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(classes.id, id))
      .returning();
    if (!updated) return jsonError("Class not found.", 404);
    return jsonOk({ class: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message.includes("owner") || message.includes("admin") ? 403 : 500);
  }
}
