import { assertCanManageStudents } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { trialLeads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { contactFieldsFromBody } from "@/lib/students/contact-fields";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanManageStudents();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const db = getDb();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return jsonError("Name is required.");
      updates.name = name;
    }

    const contactFields = contactFieldsFromBody(body);
    if (contactFields.primaryContact !== undefined) updates.primaryContact = contactFields.primaryContact;
    if (contactFields.primaryContactType !== undefined) updates.primaryContactType = contactFields.primaryContactType;
    if (contactFields.secondaryContact !== undefined) updates.secondaryContact = contactFields.secondaryContact;
    if (contactFields.secondaryContactType !== undefined) updates.secondaryContactType = contactFields.secondaryContactType;

    if (body.school !== undefined) updates.school = String(body.school ?? "").trim();
    if (body.parentName !== undefined) updates.parentName = String(body.parentName ?? "").trim();
    if (body.classId !== undefined) updates.classId = String(body.classId ?? "").trim() || null;
    if ("trialDate" in body) updates.trialDate = body.trialDate ? String(body.trialDate).trim() : null;
    if (body.notes !== undefined) updates.notes = String(body.notes ?? "").trim();

    const [updated] = await db
      .update(trialLeads)
      .set(updates)
      .where(eq(trialLeads.id, id))
      .returning();

    if (!updated) return jsonError("Trial not found.", 404);

    return jsonOk({ trial: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("cannot edit") || message.includes("Roster")
          ? 403
          : 500;
    return jsonError(message, status);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanManageStudents();
    const { id } = await params;
    const db = getDb();
    const [deleted] = await db.delete(trialLeads).where(eq(trialLeads.id, id)).returning();
    if (!deleted) return jsonError("Trial not found.", 404);
    return jsonOk({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}
