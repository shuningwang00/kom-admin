import {
  assertCanManageStudents,
  assertCanReadRoster,
} from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assignStudentBillingGroup } from "@/lib/billing-groups/resolve";
import { getDb } from "@/lib/db/index";
import { billingGroups, students } from "@/lib/db/schema";
import { contactFieldsFromBody } from "@/lib/students/contact-fields";
import { deleteStudentPermanently } from "@/lib/students/delete";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await assertCanReadRoster();
    const { id } = await params;
    const db = getDb();
    const [row] = await db
      .select({
        student: students,
        billingGroupLabel: billingGroups.label,
      })
      .from(students)
      .leftJoin(billingGroups, eq(students.billingGroupId, billingGroups.id))
      .where(eq(students.id, id))
      .limit(1);
    if (!row) return jsonError("Student not found.", 404);
    return jsonOk({
      student: {
        ...row.student,
        billingGroupLabel: row.billingGroupLabel ?? null,
      },
    });
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
    Object.assign(patch, contactFieldsFromBody(body));
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

    const siblingIds = Array.isArray(body.siblingStudentIds)
      ? (body.siblingStudentIds as string[])
      : undefined;
    if (
      body.billingGroupId !== undefined ||
      (siblingIds && siblingIds.length > 0) ||
      body.clearBillingGroup === true
    ) {
      await assignStudentBillingGroup(db, id, {
        billingGroupId: body.clearBillingGroup
          ? null
          : body.billingGroupId != null
            ? String(body.billingGroupId).trim() || null
            : undefined,
        siblingStudentIds: siblingIds,
        label:
          body.billingGroupLabel != null
            ? String(body.billingGroupLabel)
            : undefined,
      });
    }

    const [refreshed] = await db
      .select({
        student: students,
        billingGroupLabel: billingGroups.label,
      })
      .from(students)
      .leftJoin(billingGroups, eq(students.billingGroupId, billingGroups.id))
      .where(eq(students.id, id))
      .limit(1);

    return jsonOk({
      student: refreshed
        ? {
            ...refreshed.student,
            billingGroupLabel: refreshed.billingGroupLabel ?? null,
          }
        : updated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized" ? 401 : message.includes("cannot") ? 403 : 500;
    return jsonError(message, status);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await assertCanManageStudents();
    const { id } = await params;
    const summary = await deleteStudentPermanently(id);
    return jsonOk({ deleted: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message === "Student not found."
          ? 404
          : 500;
    return jsonError(message, status);
  }
}
