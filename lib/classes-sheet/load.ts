import { getClassesCacheSeconds } from "@/lib/classes-sheet/config";
import { fetchClassesSheetRows } from "@/lib/classes-sheet/google";
import {
  readPersistedClassesSnapshot,
  writePersistedClassesSnapshot,
} from "@/lib/classes-sheet/persisted-cache";
import {
  parseClassesFromSheetRows,
  type ParsedSheetClass,
} from "@/lib/classes-sheet/parser";

export type ClassesLoadSource = "sheet" | "snapshot" | "memory";

export type ClassesLoadResult = {
  parsed: ParsedSheetClass[];
  source: ClassesLoadSource;
  syncedAt: string;
  sheetTitle?: string;
  error?: string;
};

let memory: { at: number; result: ClassesLoadResult } | null = null;

export async function loadParsedClassesFromSheet(
  force = false,
): Promise<ClassesLoadResult> {
  const ttl = getClassesCacheSeconds() * 1000;
  if (!force && memory && Date.now() - memory.at < ttl) {
    return memory.result;
  }

  try {
    const { rows, sheetTitle } = await fetchClassesSheetRows();
    const parsed = parseClassesFromSheetRows(rows);
    const syncedAt = new Date().toISOString();

    await writePersistedClassesSnapshot({ parsed, syncedAt, sheetTitle });

    const result: ClassesLoadResult = {
      parsed,
      source: "sheet",
      syncedAt,
      sheetTitle,
    };
    memory = { at: Date.now(), result };
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sheet load failed";
    console.error("[classes-sheet]", message);

    const snapshot = await readPersistedClassesSnapshot();
    if (snapshot) {
      const result: ClassesLoadResult = {
        parsed: snapshot.parsed,
        source: "snapshot",
        syncedAt: snapshot.syncedAt,
        sheetTitle: snapshot.sheetTitle,
        error: message,
      };
      memory = { at: Date.now(), result };
      return result;
    }

    const result: ClassesLoadResult = {
      parsed: [],
      source: "snapshot",
      syncedAt: new Date().toISOString(),
      error: message,
    };
    memory = { at: Date.now(), result };
    return result;
  }
}
