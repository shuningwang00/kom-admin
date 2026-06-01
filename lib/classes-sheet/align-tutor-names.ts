import type { getDb } from "@/lib/db/index";
import { classes, siteAllowlist, tutorOoo } from "@/lib/db/schema";
import type { ParsedSheetClass } from "@/lib/classes-sheet/parser";
import { and, eq, or, sql } from "drizzle-orm";

async function alignAllowlistToCanonicalTutors(
  db: ReturnType<typeof getDb>,
  canonicalTutors: string[],
): Promise<number> {
  if (canonicalTutors.length === 0) return 0;

  const members = await db
    .select()
    .from(siteAllowlist)
    .where(
      and(
        eq(siteAllowlist.isActive, true),
        or(
          eq(siteAllowlist.role, "tutor"),
          eq(siteAllowlist.role, "staff_tutor"),
        ),
      ),
    );

  let updated = 0;

  for (const member of members) {
    const oldMatch = member.tutorMatch.trim();
    if (!oldMatch) continue;

    const canonical = canonicalTutors.find(
      (t) => t.toUpperCase() === oldMatch.toUpperCase(),
    );
    if (!canonical || canonical === oldMatch) continue;

    const display = member.displayName.trim();
    const patchDisplay =
      !display ||
      display.toUpperCase() === oldMatch.toUpperCase() ||
      display === oldMatch;

    await db
      .update(siteAllowlist)
      .set({
        tutorMatch: canonical,
        ...(patchDisplay ? { displayName: canonical } : {}),
      })
      .where(eq(siteAllowlist.id, member.id));

    await db
      .update(tutorOoo)
      .set({ tutorMatch: canonical })
      .where(
        sql`upper(${tutorOoo.tutorMatch}) = upper(${oldMatch}) and ${tutorOoo.tutorMatch} <> ${canonical}`,
      );

    updated += 1;
  }

  return updated;
}

/**
 * After sheet sync — align allowlist / OOO to tutor spellings from parsed sheet rows.
 */
export async function alignAllowlistTutorNamesFromSheet(
  db: ReturnType<typeof getDb>,
  parsed: ParsedSheetClass[],
): Promise<number> {
  const sheetTutors = [
    ...new Set(parsed.map((r) => r.tutor.trim()).filter(Boolean)),
  ];
  return alignAllowlistToCanonicalTutors(db, sheetTutors);
}

/**
 * Align allowlist / OOO to spellings already stored on `classes.tutor` (post-sync DB).
 */
export async function alignAllowlistTutorNamesFromClasses(
  db: ReturnType<typeof getDb>,
): Promise<number> {
  const rows = await db
    .selectDistinct({ tutor: classes.tutor })
    .from(classes)
    .where(eq(classes.isActive, true));
  const classTutors = [
    ...new Set(rows.map((r) => r.tutor.trim()).filter(Boolean)),
  ];
  return alignAllowlistToCanonicalTutors(db, classTutors);
}
