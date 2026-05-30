import { assertCanManageStudents } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { enrollments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await assertCanManageStudents();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const db = getDb();
    const patch: Partial<typeof enrollments.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.freeTrial != null) patch.freeTrial = Boolean(body.freeTrial);
    if (body.registrationFeeDue != null) {
      patch.registrationFeeDue = Boolean(body.registrationFeeDue);
    }
    if (body.notes != null) patch.notes = String(body.notes).trim();
    if (body.end === true) {
      patch.endedAt =
        body.endedAt != null && body.endedAt !== ""
          ? String(body.endedAt)
          : new Date().toISOString().slice(0, 10);
    }

    const [updated] = await db
      .update(enrollments)
      .set(patch)
      .where(eq(enrollments.id, id))
      .returning();
    if (!updated) return jsonError("Enrollment not found.", 404);
    return jsonOk({ enrollment: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized" ? 401 : message.includes("cannot") ? 403 : 500;
    return jsonError(message, status);
  }
}
