import { assertCanManageStudents, assertCanReadRoster } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { loadBillingGroupMembers } from "@/lib/billing-groups/resolve";
import { getDb } from "@/lib/db/index";
import { billingGroups, students } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await assertCanReadRoster();
    const { id } = await params;
    const db = getDb();
    const [group] = await db
      .select()
      .from(billingGroups)
      .where(eq(billingGroups.id, id))
      .limit(1);
    if (!group) return jsonError("Group not found.", 404);
    const members = await loadBillingGroupMembers(db, id);
    return jsonOk({ group: { ...group, members } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await assertCanManageStudents();
    const { id } = await params;
    const body = (await request.json()) as {
      label?: string;
      notes?: string;
      addStudentIds?: string[];
      removeStudentIds?: string[];
    };

    const db = getDb();
    const patch: Partial<typeof billingGroups.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.label != null) patch.label = String(body.label).trim();
    if (body.notes != null) patch.notes = String(body.notes).trim();

    const [group] = await db
      .update(billingGroups)
      .set(patch)
      .where(eq(billingGroups.id, id))
      .returning();
    if (!group) return jsonError("Group not found.", 404);

    const addIds = (body.addStudentIds ?? []).map((s) => s.trim()).filter(Boolean);
    if (addIds.length > 0) {
      await db
        .update(students)
        .set({ billingGroupId: id, updatedAt: new Date() })
        .where(inArray(students.id, addIds));
    }

    const removeIds = (body.removeStudentIds ?? [])
      .map((s) => s.trim())
      .filter(Boolean);
    if (removeIds.length > 0) {
      await db
        .update(students)
        .set({ billingGroupId: null, updatedAt: new Date() })
        .where(inArray(students.id, removeIds));
    }

    const members = await loadBillingGroupMembers(db, id);
    if (members.length < 2) {
      await db.delete(billingGroups).where(eq(billingGroups.id, id));
      return jsonOk({ group: null, dissolved: true });
    }

    return jsonOk({ group: { ...group, members } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}
