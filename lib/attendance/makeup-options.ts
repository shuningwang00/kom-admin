import { formatWeekdayLabel } from "@/lib/classes/display-label";
import {
  programmeTypeLabel,
  sameProgramme,
} from "@/lib/classes/match-programme";
import { nextDateForWeekdayAfter } from "@/lib/dates/calendar";
import { getDb } from "@/lib/db/index";
import { classes, enrollments } from "@/lib/db/schema";
import type { Weekday } from "@/lib/scheduling/weekday";
import { normalizeTimeLabel } from "@/lib/scheduling/time-slots";
import { eq, isNull } from "drizzle-orm";

export type MakeupClassOption = {
  classId: string;
  label: string;
  weekday: Weekday;
  defaultDate: string;
  defaultTime: string;
  regularTutor: string;
};

function shortClassSlotLabel(c: {
  level: string;
  label: string;
  weekday: Weekday;
}): string {
  const day = formatWeekdayLabel(c.weekday);
  const level = c.level.trim();
  if (level) return `${day} ${level}`;
  const type = programmeTypeLabel(c);
  return `${day} ${type}`;
}

function defaultTimeForClass(time: string): string {
  return normalizeTimeLabel(time) || time.trim();
}

async function activeEnrollmentClassIds(
  db: ReturnType<typeof getDb>,
): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ classId: enrollments.classId })
    .from(enrollments)
    .where(isNull(enrollments.endedAt));
  return new Set(rows.map((r) => r.classId));
}

export async function listMakeupPeerClasses(
  sourceClassId: string,
  missedSessionDate: string,
): Promise<{
  programmeType: string;
  missedDate: string;
  sourceClass: MakeupClassOption;
  peerClasses: MakeupClassOption[];
}> {
  const db = getDb();
  const [source] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, sourceClassId))
    .limit(1);
  if (!source) throw new Error("Class not found.");

  const enrolledIds = await activeEnrollmentClassIds(db);

  const peerClasses = (
    await db.select().from(classes).where(eq(classes.isActive, true))
  ).filter(
    (c) =>
      c.id !== sourceClassId &&
      enrolledIds.has(c.id) &&
      sameProgramme(source, c),
  );

  const options: MakeupClassOption[] = [];
  for (const c of peerClasses) {
    const defaultDate = nextDateForWeekdayAfter(
      missedSessionDate,
      c.weekday,
    );
    if (!defaultDate) continue;
    options.push({
      classId: c.id,
      label: shortClassSlotLabel(c),
      weekday: c.weekday,
      defaultDate,
      defaultTime: defaultTimeForClass(c.time),
      regularTutor: c.tutor,
    });
  }

  options.sort((a, b) => a.defaultDate.localeCompare(b.defaultDate));

  const sourceDefaultDate =
    nextDateForWeekdayAfter(missedSessionDate, source.weekday) ||
    missedSessionDate;

  const sourceClass: MakeupClassOption = {
    classId: source.id,
    label: shortClassSlotLabel(source),
    weekday: source.weekday,
    defaultDate: sourceDefaultDate,
    defaultTime: defaultTimeForClass(source.time),
    regularTutor: source.tutor,
  };

  return {
    programmeType: programmeTypeLabel(source),
    missedDate: missedSessionDate,
    sourceClass,
    peerClasses: options,
  };
}
