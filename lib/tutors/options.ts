import { getDb } from "@/lib/db/index";
import { siteAllowlist } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listExtraReliefTutorNames } from "@/lib/tutors/relief-tutor-names";
import { listScheduleTutorNames } from "@/lib/tutors/schedule-tutors";

function sortTutorNames(names: Iterable<string>): string[] {
  return [...names].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );
}

/** Known tutor names for relief dropdowns (schedule + allowlist + relief-only list). */
export async function listTutorOptions(): Promise<string[]> {
  const db = getDb();
  const [schedule, extraRelief, fromAllowlist] = await Promise.all([
    listScheduleTutorNames(),
    listExtraReliefTutorNames(db),
    db
      .select({ tutorMatch: siteAllowlist.tutorMatch })
      .from(siteAllowlist)
      .where(eq(siteAllowlist.isActive, true)),
  ]);

  const names = new Set<string>([...schedule, ...extraRelief]);
  for (const row of fromAllowlist) {
    const match = row.tutorMatch.trim();
    if (match) names.add(match);
  }

  return sortTutorNames(names);
}
