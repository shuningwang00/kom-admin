import type { getDb } from "@/lib/db/index";
import { reliefOnlyTutor } from "@/lib/db/schema";
import { asc, sql } from "drizzle-orm";

export type ReliefOnlyTutorRow = { id: string; name: string };

function isMissingReliefOnlyTable(err: unknown): boolean {
  const parts: string[] = [];
  let cur: unknown = err;
  while (cur instanceof Error) {
    parts.push(cur.message);
    cur = cur.cause;
  }
  const text = parts.join(" ").toLowerCase();
  return text.includes("relief_only_tutor") && text.includes("does not exist");
}

export async function listReliefOnlyTutors(
  db: ReturnType<typeof getDb>,
): Promise<ReliefOnlyTutorRow[]> {
  try {
    const rows = await db
      .select({ id: reliefOnlyTutor.id, name: reliefOnlyTutor.name })
      .from(reliefOnlyTutor)
      .orderBy(asc(reliefOnlyTutor.name));
    return rows.map((r) => ({ id: r.id, name: r.name.trim() })).filter((r) => r.name);
  } catch (err) {
    if (isMissingReliefOnlyTable(err)) return [];
    throw err;
  }
}

export async function listReliefOnlyTutorNames(
  db: ReturnType<typeof getDb>,
): Promise<string[]> {
  return (await listReliefOnlyTutors(db)).map((r) => r.name);
}

export async function addReliefOnlyTutor(
  db: ReturnType<typeof getDb>,
  name: string,
): Promise<ReliefOnlyTutorRow> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tutor name is required.");

  const existing = await db
    .select({ id: reliefOnlyTutor.id })
    .from(reliefOnlyTutor)
    .where(sql`lower(trim(${reliefOnlyTutor.name})) = lower(trim(${trimmed}))`)
    .limit(1);
  if (existing.length > 0) {
    throw new Error(`“${trimmed}” is already on the relief tutor list.`);
  }

  const [row] = await db
    .insert(reliefOnlyTutor)
    .values({ name: trimmed })
    .returning();
  return { id: row.id, name: row.name.trim() };
}

export async function deleteReliefOnlyTutor(
  db: ReturnType<typeof getDb>,
  id: string,
): Promise<void> {
  await db.delete(reliefOnlyTutor).where(sql`${reliefOnlyTutor.id} = ${id}`);
}
