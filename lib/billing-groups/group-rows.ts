import type { BillingGroupNameEntry } from "@/lib/billing-groups/name-map";
import type { StudentBillingRow } from "@/lib/types";

export type BillingRowGroup =
  | { kind: "family"; group: BillingGroupNameEntry; rows: StudentBillingRow[] }
  | { kind: "single"; row: StudentBillingRow };

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Group sheet rows by roster sibling billing group (one family = one bill). */
export function groupBillingRowsByFamily(
  rows: StudentBillingRow[],
  byNormalizedName: Map<string, BillingGroupNameEntry>,
): BillingRowGroup[] {
  const familyBuckets = new Map<string, StudentBillingRow[]>();
  const singles: StudentBillingRow[] = [];

  for (const row of rows) {
    const entry = byNormalizedName.get(normalizeName(row.studentName));
    if (!entry || entry.memberNames.length < 2) {
      singles.push(row);
      continue;
    }
    const bucket = familyBuckets.get(entry.groupId) ?? [];
    bucket.push(row);
    familyBuckets.set(entry.groupId, bucket);
  }

  const result: BillingRowGroup[] = [];

  for (const [, bucket] of familyBuckets) {
    const entry = byNormalizedName.get(normalizeName(bucket[0]!.studentName));
    if (!entry) continue;
    bucket.sort((a, b) => a.studentName.localeCompare(b.studentName));
    result.push({ kind: "family", group: entry, rows: bucket });
  }

  for (const row of singles) {
    result.push({ kind: "single", row });
  }

  result.sort((a, b) => {
    const nameA =
      a.kind === "family" ? a.group.label : a.row.studentName;
    const nameB =
      b.kind === "family" ? b.group.label : b.row.studentName;
    return nameA.localeCompare(nameB);
  });

  return result;
}

export function familyGroupTotal(rows: StudentBillingRow[]): number {
  return Math.round(rows.reduce((s, r) => s + r.computedAmount, 0) * 100) / 100;
}
