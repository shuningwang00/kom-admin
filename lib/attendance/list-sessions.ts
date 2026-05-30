import type { SessionUser } from "@/lib/auth/config";
import { getTutorMatch, tutorCanAccessClass } from "@/lib/auth/user";
import { getDb } from "@/lib/db/index";
import { classSessions, classes } from "@/lib/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";

export async function listSessionsForDate(date: string, user: SessionUser) {
  const db = getDb();
  const rows = await db
    .select({ session: classSessions, class: classes })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(
      and(
        eq(classSessions.scheduledDate, date),
        eq(classSessions.status, "scheduled"),
        eq(classes.isActive, true),
      ),
    )
    .orderBy(asc(classes.time), asc(classes.label));

  if (user.role === "owner" || user.role === "staff") return rows;

  const match = await getTutorMatch(user.email);
  return rows.filter((r) => tutorCanAccessClass(r.class.tutor, match));
}

export async function listTutorSessionsOverview(user: SessionUser) {
  const db = getDb();
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 14);
  const to = new Date(today);
  to.setDate(to.getDate() + 60);

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const rows = await db
    .select({ session: classSessions, class: classes })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(
      and(
        gte(classSessions.scheduledDate, fromStr),
        lte(classSessions.scheduledDate, toStr),
        eq(classSessions.status, "scheduled"),
        eq(classes.isActive, true),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate), asc(classes.time));

  const match =
    user.role === "owner" || user.role === "staff"
      ? ""
      : await getTutorMatch(user.email);
  const filtered =
    user.role === "owner" || user.role === "staff"
      ? rows
      : rows.filter((r) => tutorCanAccessClass(r.class.tutor, match));

  const byClass = new Map<
    string,
    {
      class: (typeof filtered)[0]["class"];
      sessions: (typeof filtered)[0]["session"][];
    }
  >();

  for (const row of filtered) {
    const key = row.class.id;
    if (!byClass.has(key)) {
      byClass.set(key, { class: row.class, sessions: [] });
    }
    byClass.get(key)!.sessions.push(row.session);
  }

  return [...byClass.values()];
}
