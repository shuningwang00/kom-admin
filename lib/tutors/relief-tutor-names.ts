import type { getDb } from "@/lib/db/index";
import { siteAllowlist } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listReliefOnlyTutorNames } from "@/lib/tutors/relief-only-tutors";

/** Relief picker label for an allowlist row flagged as also relief. */
export function reliefNameFromAllowlistRow(row: {
  displayName: string | null;
  tutorMatch: string | null;
}): string {
  return row.displayName?.trim() || row.tutorMatch?.trim() || "";
}

export async function listAlsoReliefTutorNames(
  db: ReturnType<typeof getDb>,
): Promise<string[]> {
  const rows = await db
    .select({
      displayName: siteAllowlist.displayName,
      tutorMatch: siteAllowlist.tutorMatch,
    })
    .from(siteAllowlist)
    .where(eq(siteAllowlist.alsoReliefTutor, true));

  const names = new Set<string>();
  for (const row of rows) {
    const name = reliefNameFromAllowlistRow(row);
    if (name) names.add(name);
  }
  return [...names];
}

export async function listExtraReliefTutorNames(
  db: ReturnType<typeof getDb>,
): Promise<string[]> {
  const [legacy, alsoStaff] = await Promise.all([
    listReliefOnlyTutorNames(db),
    listAlsoReliefTutorNames(db),
  ]);
  const names = new Set<string>([...legacy, ...alsoStaff]);
  return [...names].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );
}
