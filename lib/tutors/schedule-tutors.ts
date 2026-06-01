import { getDb } from "@/lib/db/index";
import { classes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** Distinct tutor names on active classes (Google Sheet sync). */
export async function listScheduleTutorNames(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ tutor: classes.tutor })
    .from(classes)
    .where(eq(classes.isActive, true));
  return rows
    .map((r) => r.tutor.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}
