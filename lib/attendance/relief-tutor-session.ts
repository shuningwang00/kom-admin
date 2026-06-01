import type { SessionExpectedCounts } from "@/lib/attendance/session-expected-labels";
import { isReliefTutorNeeded } from "@/lib/tutors/constants";
import type { getDb } from "@/lib/db/index";
import { classSessions } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

/** Billable / teachable headcount (excludes pre-notified absent). */
export function sessionActiveExpectedTotal(
  expected: SessionExpectedCounts,
): number {
  return expected.regular + expected.trial + expected.makeup;
}

/** Relief cover is only relevant when someone is expected in class. */
export function sessionShowsReliefTutorNeeded(
  reliefTutor: string | null | undefined,
  expected: SessionExpectedCounts,
): boolean {
  return (
    isReliefTutorNeeded(reliefTutor) && sessionActiveExpectedTotal(expected) > 0
  );
}

type SessionExpectedRow = {
  session: { id: string; reliefTutor?: string | null };
  expected: SessionExpectedCounts;
};

/** Drop stale `__relief_tutor_needed__` when class expected is 0. */
export async function clearReliefTutorNeededWhereNoStudents(
  db: ReturnType<typeof getDb>,
  rows: SessionExpectedRow[],
): Promise<void> {
  const staleIds = rows
    .filter(
      (r) =>
        isReliefTutorNeeded(r.session.reliefTutor) &&
        sessionActiveExpectedTotal(r.expected) === 0,
    )
    .map((r) => r.session.id);
  if (staleIds.length === 0) return;
  await db
    .update(classSessions)
    .set({ reliefTutor: "", updatedAt: new Date() })
    .where(inArray(classSessions.id, staleIds));
}

export async function normalizeSessionReliefTutor(
  db: ReturnType<typeof getDb>,
  sessionId: string,
  reliefTutor: string | null | undefined,
  expected: SessionExpectedCounts,
): Promise<string> {
  const relief = (reliefTutor ?? "").trim();
  if (!isReliefTutorNeeded(relief)) return relief;
  if (sessionActiveExpectedTotal(expected) > 0) return relief;
  await db
    .update(classSessions)
    .set({ reliefTutor: "", updatedAt: new Date() })
    .where(inArray(classSessions.id, [sessionId]));
  return "";
}
