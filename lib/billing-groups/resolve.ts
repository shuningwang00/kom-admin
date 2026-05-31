import type { getDb } from "@/lib/db/index";
import { billingGroups, students } from "@/lib/db/schema";
import { defaultBillingGroupLabel } from "@/lib/billing-groups/labels";
import { eq, inArray } from "drizzle-orm";

type Db = ReturnType<typeof getDb>;

export async function loadBillingGroupMembers(
  db: Db,
  groupId: string,
): Promise<Array<{ id: string; name: string }>> {
  return db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(eq(students.billingGroupId, groupId))
    .orderBy(students.name);
}

/** Assign student to a group, join siblings' group, or create a new family group. */
export async function assignStudentBillingGroup(
  db: Db,
  studentId: string,
  opts: {
    billingGroupId?: string | null;
    siblingStudentIds?: string[];
    label?: string;
  },
): Promise<string | null> {
  if (opts.billingGroupId === null) {
    await db
      .update(students)
      .set({ billingGroupId: null, updatedAt: new Date() })
      .where(eq(students.id, studentId));
    return null;
  }

  if (opts.billingGroupId) {
    await db
      .update(students)
      .set({ billingGroupId: opts.billingGroupId, updatedAt: new Date() })
      .where(eq(students.id, studentId));
    return opts.billingGroupId;
  }

  const siblingIds = (opts.siblingStudentIds ?? [])
    .map((id) => id.trim())
    .filter((id) => id && id !== studentId);

  if (siblingIds.length === 0) {
    return null;
  }

  const siblingRows = await db
    .select({
      id: students.id,
      name: students.name,
      billingGroupId: students.billingGroupId,
    })
    .from(students)
    .where(inArray(students.id, siblingIds));

  const existingGroupId = siblingRows
    .map((r) => r.billingGroupId)
    .find((id) => id != null);

  if (existingGroupId) {
    await db
      .update(students)
      .set({ billingGroupId: existingGroupId, updatedAt: new Date() })
      .where(eq(students.id, studentId));
    return existingGroupId;
  }

  const [self] = await db
    .select({ name: students.name })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);

  const names = [
    self?.name ?? "",
    ...siblingRows.map((r) => r.name),
  ].filter(Boolean);
  const label =
    opts.label?.trim() || defaultBillingGroupLabel(names);

  const [group] = await db
    .insert(billingGroups)
    .values({ label })
    .returning();

  const allIds = [studentId, ...siblingIds];
  await db
    .update(students)
    .set({ billingGroupId: group.id, updatedAt: new Date() })
    .where(inArray(students.id, allIds));

  return group.id;
}
