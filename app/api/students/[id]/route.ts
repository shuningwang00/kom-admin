import {
  assertCanManageStudents,
  assertCanReadRoster,
} from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await assertCanReadRoster();
    const { id } = await params;
    const db = getDb();
    const [row] = await db.select().from(students).where(eq(students.id, id));
    if (!row) return jsonError("Student not found.", 404);
    return jsonOk({ student: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await assertCanManageStudents();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const db = getDb();

    const patch: Partial<typeof students.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name != null) patch.name = String(body.name).trim();
    if (body.contact != null) patch.contact = String(body.contact).trim();
    if (body.school != null) patch.school = String(body.school).trim();
    if (body.parentName != null)
      patch.parentName = String(body.parentName).trim();
    if (body.startDate !== undefined) {
      patch.startDate =
        body.startDate == null || body.startDate === ""
          ? null
          : String(body.startDate);
    }
    if (body.notes != null) patch.notes = String(body.notes).trim();
    if (body.archive === true) patch.archivedAt = new Date();
    if (body.archive === false) patch.archivedAt = null;

    const [updated] = await db
      .update(students)
      .set(patch)
      .where(eq(students.id, id))
      .returning();
    if (!updated) return jsonError("Student not found.", 404);
    return jsonOk({ student: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized" ? 401 : message.includes("cannot") ? 403 : 500;
    return jsonError(message, status);
  }
}
