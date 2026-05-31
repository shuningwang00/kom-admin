import { getDb } from "@/lib/db/index";
import { classes, siteAllowlist } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** Known tutor names for relief dropdown (classes sheet + team allowlist). */
export async function listTutorOptions(): Promise<string[]> {
  const db = getDb();
  const fromClasses = await db
    .selectDistinct({ tutor: classes.tutor })
    .from(classes)
    .where(eq(classes.isActive, true));

  const fromAllowlist = await db
    .select({
      tutorMatch: siteAllowlist.tutorMatch,
      displayName: siteAllowlist.displayName,
    })
    .from(siteAllowlist)
    .where(eq(siteAllowlist.isActive, true));

  const names = new Set<string>();
  for (const row of fromClasses) {
    const t = row.tutor.trim();
    if (t) names.add(t);
  }
  for (const row of fromAllowlist) {
    const match = row.tutorMatch.trim();
    const display = row.displayName.trim();
    if (match) names.add(match);
    if (display) names.add(display);
  }

  return [...names].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );
}
