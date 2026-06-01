import type { getDb } from "@/lib/db/index";
import { classes, importRuns } from "@/lib/db/schema";
import { loadParsedClassesFromSheet } from "@/lib/classes-sheet/load";
import { getClassesSpreadsheetId } from "@/lib/classes-sheet/config";
import { canonicalTimeLabel } from "@/lib/scheduling/time-slots";
import { and, desc, eq } from "drizzle-orm";

type Db = ReturnType<typeof getDb>;

type SyncResult = {
  synced: boolean;
  count: number;
  source?: string;
  syncedAt?: string;
  backupAt?: string;
  error?: string;
};

async function applyParsedToDb(
  db: Db,
  parsed: Awaited<ReturnType<typeof loadParsedClassesFromSheet>>["parsed"],
) {
  for (const row of parsed) {
    const [existing] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.label, row.label), eq(classes.weekday, row.weekday)))
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

/** Returns last sync metadata from DB without touching classes or Google Sheets. */
export async function getLastSyncInfo(db: Db): Promise<{ syncedAt?: string; backupAt?: string }> {
  const [lastSync] = await db
    .select({ createdAt: importRuns.createdAt })
    .from(importRuns)
    .where(eq(importRuns.source, "sheet-sync"))
    .orderBy(desc(importRuns.createdAt))
    .limit(1);

  const [lastBackup] = await db
    .select({ createdAt: importRuns.createdAt })
    .from(importRuns)
    .where(eq(importRuns.source, "classes-backup"))
    .orderBy(desc(importRuns.createdAt))
    .limit(1);

  return {
    syncedAt: lastSync?.createdAt.toISOString(),
    backupAt: lastBackup?.createdAt.toISOString(),
  };
}

/**
 * DB is the source of truth. Classes persist across server restarts.
 *
 * When force=false: returns last sync metadata from import_runs, no Sheet call.
 * When force=true:  backs up current classes, then syncs from Google Sheets.
 */
export async function syncClassesFromSheetIfConfigured(
  db: Db,
  force = false,
): Promise<SyncResult> {
  if (!force) {
    const info = await getLastSyncInfo(db);
    return { synced: false, count: 0, syncedAt: info.syncedAt, backupAt: info.backupAt };
  }

  // ── Back up current classes before overwriting ─────────────────────────────
  const currentClasses = await db.select().from(classes);
  if (currentClasses.length > 0) {
    await db.insert(importRuns).values({
      source: "classes-backup",
      statsJson: JSON.stringify(currentClasses),
    });
  }

  // ── Fetch from Google Sheets and apply ────────────────────────────────────
  const loaded = await loadParsedClassesFromSheet(true);
  if (loaded.parsed.length === 0) {
    return {
      synced: false,
      count: 0,
      source: loaded.source,
      error: loaded.error ?? "No classes found in Google Sheet.",
    };
  }

  await applyParsedToDb(db, loaded.parsed);

  const syncedAt = new Date().toISOString();
  await db.insert(importRuns).values({
    source: "sheet-sync",
    spreadsheetId: getClassesSpreadsheetId(),
    statsJson: JSON.stringify({ count: loaded.parsed.length, sheetTitle: loaded.sheetTitle }),
  });

  const info = await getLastSyncInfo(db);

  return {
    synced: true,
    count: loaded.parsed.length,
    source: "sheet",
    syncedAt,
    backupAt: info.backupAt,
    error: loaded.error,
  };
}

/** Restore classes from the most recent backup stored in import_runs. */
export async function restoreClassesFromBackup(db: Db): Promise<{ restored: number; error?: string }> {
  const [latestBackup] = await db
    .select({ statsJson: importRuns.statsJson, createdAt: importRuns.createdAt })
    .from(importRuns)
    .where(eq(importRuns.source, "classes-backup"))
    .orderBy(desc(importRuns.createdAt))
    .limit(1);

  if (!latestBackup) {
    return { restored: 0, error: "No backup found." };
  }

  type BackedUpClass = {
    label: string;
    level: string;
    time: string;
    tutor: string;
    weekday: string;
    isActive: boolean;
  };

  const backed = JSON.parse(latestBackup.statsJson) as BackedUpClass[];
  if (!Array.isArray(backed) || backed.length === 0) {
    return { restored: 0, error: "Backup is empty." };
  }

  for (const row of backed) {
    const weekday = row.weekday as (typeof classes.$inferInsert)["weekday"];
    const [existing] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.label, row.label), eq(classes.weekday, weekday)))
      .limit(1);

    const values = {
      label: row.label,
      level: row.level ?? "",
      time: row.time ?? "",
      tutor: row.tutor ?? "",
      weekday,
      isActive: Boolean(row.isActive),
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(classes).set(values).where(eq(classes.id, existing.id));
    } else {
      await db.insert(classes).values(values);
    }
  }

  return { restored: backed.length };
}
