import { getDb } from "@/lib/db/index";
import { billingGroups, students } from "@/lib/db/schema";
import { isNull } from "drizzle-orm";

export type BillingGroupNameEntry = {
  groupId: string;
  label: string;
  memberNames: string[];
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Map sheet / display names to billing group for combined invoices. */
export async function loadBillingGroupNameMap(): Promise<{
  byNormalizedName: Map<string, BillingGroupNameEntry>;
  groups: BillingGroupNameEntry[];
}> {
  const db = getDb();
  const rows = await db
    .select({
      id: students.id,
      name: students.name,
      billingGroupId: students.billingGroupId,
    })
    .from(students)
    .where(isNull(students.archivedAt));

  const groupRows = await db.select().from(billingGroups);
  const labelById = new Map(groupRows.map((g) => [g.id, g.label]));

  const byGroup = new Map<string, { label: string; names: string[] }>();

  for (const row of rows) {
    if (!row.billingGroupId) continue;
    const label =
      labelById.get(row.billingGroupId) ??
      defaultLabelFromNames(byGroup.get(row.billingGroupId)?.names ?? []);
    const entry = byGroup.get(row.billingGroupId) ?? { label, names: [] };
    entry.names.push(row.name);
    byGroup.set(row.billingGroupId, entry);
  }

  const groups: BillingGroupNameEntry[] = [];
  const byNormalizedName = new Map<string, BillingGroupNameEntry>();

  for (const [groupId, { label, names }] of byGroup) {
    const entry: BillingGroupNameEntry = {
      groupId,
      label: label || defaultLabelFromNames(names),
      memberNames: [...names].sort((a, b) => a.localeCompare(b)),
    };
    groups.push(entry);
    for (const name of names) {
      byNormalizedName.set(normalizeName(name), entry);
    }
  }

  groups.sort((a, b) => a.label.localeCompare(b.label));
  return { byNormalizedName, groups };
}

function defaultLabelFromNames(names: string[]): string {
  if (names.length === 0) return "Family";
  if (names.length <= 2) return names.join(" & ");
  return `${names[0]} & ${names.length - 1} more`;
}

export function lookupBillingGroupForName(
  studentName: string,
  byNormalizedName: Map<string, BillingGroupNameEntry>,
): BillingGroupNameEntry | null {
  return byNormalizedName.get(normalizeName(studentName)) ?? null;
}
