import { computeConsolidatedSlotMetrics } from "@/lib/attendance/consolidated-slot-metrics";
import type { SessionExpectedCounts } from "@/lib/attendance/session-expected-labels";
import {
  canonicalSlotTimeLabel,
  pickCanonicalSessionRow,
  sessionSlotConsolidationKey,
  type SessionClassRow,
} from "@/lib/attendance/session-slot-matching";

export type ConsolidatableSessionRow = SessionClassRow & {
  expected: SessionExpectedCounts;
  expectedLabel: string;
  waivedCount: number;
  studentsToMarkCount: number;
  savedCount: number;
  attendanceMarked: boolean;
  attendanceMarkLabel: string;
};

/** One daily-list row per programme + time + tutor slot (peer makeup shares a session). */
export async function mergeConsolidatedSessionListRows<
  T extends ConsolidatableSessionRow,
>(rows: T[]): Promise<T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = sessionSlotConsolidationKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const merged: T[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    const primary = pickCanonicalSessionRow(group);
    const metrics = await computeConsolidatedSlotMetrics(group);

    merged.push({
      ...primary,
      session: {
        ...primary.session,
        timeLabel: canonicalSlotTimeLabel(primary),
      },
      ...metrics,
    });
  }

  return merged.sort((a, b) => {
    const ta = a.class.time.localeCompare(b.class.time);
    if (ta !== 0) return ta;
    return a.class.label.localeCompare(b.class.label);
  });
}
