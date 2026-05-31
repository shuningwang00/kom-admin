import fs from "fs/promises";
import path from "path";
import type { ParsedSheetClass } from "@/lib/classes-sheet/parser";

export type PersistedClassesSnapshot = {
  parsed: ParsedSheetClass[];
  syncedAt: string;
  sheetTitle?: string;
};

function cachePath(): string {
  if (process.env.CLASSES_CACHE_FILE?.trim()) {
    return process.env.CLASSES_CACHE_FILE.trim();
  }
  if (process.env.VERCEL) {
    return path.join("/tmp", "kom-admin-classes.snapshot.json");
  }
  return path.join(process.cwd(), "data", "classes-admin.snapshot.json");
}

export async function readPersistedClassesSnapshot(): Promise<PersistedClassesSnapshot | null> {
  try {
    const raw = await fs.readFile(cachePath(), "utf8");
    const data = JSON.parse(raw) as PersistedClassesSnapshot;
    if (!Array.isArray(data.parsed) || data.parsed.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

export async function writePersistedClassesSnapshot(
  snapshot: PersistedClassesSnapshot,
): Promise<void> {
  const file = cachePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(snapshot, null, 2), "utf8");
}
