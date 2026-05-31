import type { getDb } from "@/lib/db/index";
import { classes } from "@/lib/db/schema";
import { loadParsedClassesFromSheet } from "@/lib/classes-sheet/load";
import { canonicalTimeLabel } from "@/lib/scheduling/time-slots";
import { and, eq } from "drizzle-orm";

type Db = ReturnType<typeof getDb>;

let lastDbSyncAt = 0;
let lastDbSyncSource: string | null = null;

async function applyParsedToDb(
  db: Db,
  parsed: Awaited<ReturnType<typeof loadParsedClassesFromSheet>>["parsed"],
) {
  for (const row of parsed) {
    const [existing] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(
        and(eq(classes.label, row.label), eq(classes.weekday, row.weekday)),
      )
      .limit(1);

    const values = {
      label: row.label,
      level: row.level,
      time: canonicalTimeLabel(row.time),
      tutor: row.tutor,
      weekday: row.weekday,
      isActive: row.status === "active",
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(classes).set(values).where(eq(classes.id, existing.id));
    } else {
      await db.insert(classes).values(values);
    }
  }
}

/**
 * Sync ACTIVE/DUMMY/FULL flags from sheet (or last saved snapshot) into the DB.
 * Dropdowns read from DB. Google is only called when cache expired or ?refresh=1.
 */
export async function syncClassesFromSheetIfConfigured(
  db: Db,
  force = false,
): Promise<{
  synced: boolean;
  count: number;
  source?: string;
  syncedAt?: string;
  error?: string;
}> {
  const ttl = Number(process.env.CLASSES_CACHE_SECONDS ?? "86400") * 1000;

  const [activeCount] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.isActive, true))
    .limit(1);

  const dbEmpty = !activeCount;

  if (
    !force &&
    !dbEmpty &&
    Date.now() - lastDbSyncAt < ttl &&
    lastDbSyncSource
  ) {
    return {
      synced: false,
      count: 0,
      source: lastDbSyncSource,
    };
  }

  const loaded = await loadParsedClassesFromSheet(force);
  if (loaded.parsed.length === 0) {
    return {
      synced: false,
      count: 0,
      source: loaded.source,
      error: loaded.error ?? "No classes in sheet or snapshot.",
    };
  }

  await applyParsedToDb(db, loaded.parsed);
  lastDbSyncAt = Date.now();
  lastDbSyncSource = loaded.source;

  return {
    synced: true,
    count: loaded.parsed.length,
    source: loaded.source,
    syncedAt: loaded.syncedAt,
    error: loaded.error,
  };
}
