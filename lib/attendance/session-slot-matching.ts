import {
  programmeKeyFromClass,
  sameProgramme,
} from "@/lib/classes/match-programme";
import { getDb } from "@/lib/db/index";
import { classSessions, classes } from "@/lib/db/schema";
import {
  canonicalTimeLabel,
  normalizeTimeLabel,
} from "@/lib/scheduling/time-slots";
import { and, eq } from "drizzle-orm";

export type SessionClassRow = {
  session: {
    id: string;
    scheduledDate: string;
    timeLabel: string;
    rescheduleNote?: string | null;
    reliefTutor?: string | null;
  };
  class: {
    id: string;
    level: string;
    label: string;
    tutor: string;
    time: string;
  };
};

/**
 * Regular generated slots keep the class timetable; only explicit reschedules
 * or ad-hoc makeup sessions use session.timeLabel (avoids bad M/U writes merging peers).
 */
export function canonicalSlotTimeLabel(row: SessionClassRow): string {
  const classNorm = normalizeTimeLabel(row.class.time);
  const sessionNorm = normalizeTimeLabel(row.session.timeLabel);
  const note = row.session.rescheduleNote?.trim() ?? "";
  // Explicit note → trust the session's stored time
  if (note && sessionNorm) return sessionNorm;
  // Session time differs from class default → was rescheduled without a note
  if (sessionNorm && classNorm && sessionNorm !== classNorm) return sessionNorm;
  return (
    classNorm ||
    sessionNorm ||
    canonicalTimeLabel(row.class.time) ||
    canonicalTimeLabel(row.session.timeLabel)
  );
}

export function sessionSlotConsolidationKey(row: SessionClassRow): string {
  const time = canonicalSlotTimeLabel(row);
  const pk = programmeKeyFromClass(row.class);
  const tutor = (row.session.reliefTutor?.trim() || row.class.tutor)
    .trim()
    .toLowerCase();
  return `${row.session.scheduledDate}|${pk.level}|${pk.subject}|${time}|${tutor}`;
}

export function slotKeyForMakeupBooking(
  scheduledDate: string,
  cls: SessionClassRow["class"],
  resolvedTime: string,
  reliefTutor = "",
): string {
  const time =
    normalizeTimeLabel(resolvedTime) ||
    normalizeTimeLabel(cls.time) ||
    resolvedTime.trim() ||
    cls.time.trim();
  const pk = programmeKeyFromClass(cls);
  const tutor = (reliefTutor.trim() || cls.tutor).trim().toLowerCase();
  return `${scheduledDate}|${pk.level}|${pk.subject}|${time}|${tutor}`;
}

/** Prefer the regular generated session over an ad-hoc makeup slot. */
export function pickCanonicalSessionRow<T extends SessionClassRow>(
  rows: T[],
): T {
  return [...rows].sort((a, b) => {
    const aAdHoc = a.session.rescheduleNote === "Makeup session" ? 1 : 0;
    const bAdHoc = b.session.rescheduleNote === "Makeup session" ? 1 : 0;
    if (aAdHoc !== bAdHoc) return aAdHoc - bAdHoc;
    return a.session.id.localeCompare(b.session.id);
  })[0];
}

export async function listSessionsInConsolidationGroup(
  db: ReturnType<typeof getDb>,
  anchor: SessionClassRow,
): Promise<SessionClassRow[]> {
  const rows = await db
    .select({ session: classSessions, class: classes })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(
      and(
        eq(classSessions.scheduledDate, anchor.session.scheduledDate),
        eq(classSessions.status, "scheduled"),
        eq(classes.isActive, true),
      ),
    );

  const key = sessionSlotConsolidationKey(anchor);
  return rows.filter(
    (r) =>
      sameProgramme(r.class, anchor.class) &&
      sessionSlotConsolidationKey(r) === key,
  );
}

export async function findSessionForMakeupSlot(
  db: ReturnType<typeof getDb>,
  scheduledDate: string,
  targetClass: SessionClassRow["class"],
  resolvedTime: string,
  reliefTutor = "",
): Promise<(typeof classSessions.$inferSelect) | undefined> {
  const key = slotKeyForMakeupBooking(
    scheduledDate,
    targetClass,
    resolvedTime,
    reliefTutor,
  );

  const rows = await db
    .select({ session: classSessions, class: classes })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(
      and(
        eq(classSessions.scheduledDate, scheduledDate),
        eq(classSessions.status, "scheduled"),
        eq(classes.isActive, true),
      ),
    );

  const matches = rows.filter(
    (r) =>
      r.class.id === targetClass.id &&
      slotKeyForMakeupBooking(
        scheduledDate,
        r.class,
        canonicalSlotTimeLabel({ session: r.session, class: r.class }),
        r.session.reliefTutor ?? "",
      ) === key,
  );

  if (!matches.length) return undefined;
  return pickCanonicalSessionRow(matches).session;
}

export async function consolidatedSessionIds(
  db: ReturnType<typeof getDb>,
  sessionId: string,
): Promise<string[]> {
  const [anchor] = await db
    .select({ session: classSessions, class: classes })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(eq(classSessions.id, sessionId))
    .limit(1);

  if (!anchor) return [sessionId];

  const group = await listSessionsInConsolidationGroup(db, anchor);
  if (group.length <= 1) return [sessionId];
  return group.map((r) => r.session.id);
}
