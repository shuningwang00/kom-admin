import {
  assertCanManageStudents,
  assertCanReadRoster,
} from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { defaultBillingGroupLabel } from "@/lib/billing-groups/labels";
import { loadBillingGroupMembers } from "@/lib/billing-groups/resolve";
import { getDb } from "@/lib/db/index";
import { billingGroups, students } from "@/lib/db/schema";
import { asc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await assertCanReadRoster();
    const db = getDb();
    const groups = await db
      .select()
      .from(billingGroups)
      .orderBy(asc(billingGroups.label));

    const enriched = await Promise.all(
      groups.map(async (g) => {
        const members = await loadBillingGroupMembers(db, g.id);
        return { ...g, members };
      }),
    );

    return jsonOk({ groups: enriched });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    await assertCanManageStudents();
    const body = (await request.json()) as {
      label?: string;
      studentIds?: string[];
      notes?: string;
    };

    const studentIds = (body.studentIds ?? [])
      .map((id) => id.trim())
      .filter(Boolean);
    if (studentIds.length < 2) {
      return jsonError("Pick at least two students for a sibling billing group.");
    }

    const db = getDb();
    const memberRows = await db
      .select({ id: students.id, name: students.name })
      .from(students)
      .where(
        inArray(students.id, studentIds),
      );

    if (memberRows.length !== studentIds.length) {
      return jsonError("One or more students were not found.");
    }

    const label =
      body.label?.trim() ||
      defaultBillingGroupLabel(memberRows.map((m) => m.name));

    const [group] = await db
      .insert(billingGroups)
      .values({
        label,
        notes: String(body.notes ?? "").trim(),
      })
      .returning();

    await db
      .update(students)
      .set({ billingGroupId: group.id, updatedAt: new Date() })
      .where(inArray(students.id, studentIds));

    const members = await loadBillingGroupMembers(db, group.id);
    return jsonOk({ group: { ...group, members } }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized" ? 401 : message.includes("cannot") ? 403 : 500;
    return jsonError(message, status);
  }
}
