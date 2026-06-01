import { slotCoversShift } from "@/lib/centre-hours";
import type { getDb } from "@/lib/db/index";
import { adminRosterShift, classSessions, classes } from "@/lib/db/schema";
import { listAvailabilityForMonth } from "@/lib/people/staff-availability";
import { listActiveStaff } from "@/lib/people/staff-list";
import { formatCalendarDate, parseYearMonth } from "@/lib/dates/calendar";
import { and, asc, eq, gte, lte } from "drizzle-orm";

export type RosterShift = {
  id: string;
  shiftDate: string;
  staffEmail: string;
  staffName: string;
  startTime: string;
  endTime: string;
  published: boolean;
  createdBy: string;
};

export async function listRosterShifts(
  db: ReturnType<typeof getDb>,
  yearMonth: string,
  opts?: { publishedOnly?: boolean },
): Promise<RosterShift[]> {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) return [];
  const { year, month } = parsed;
  const startDate = formatCalendarDate(year, month, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = formatCalendarDate(year, month, lastDay);

  const conditions = [
    gte(adminRosterShift.shiftDate, startDate),
    lte(adminRosterShift.shiftDate, endDate),
  ];
  if (opts?.publishedOnly) {
    conditions.push(eq(adminRosterShift.published, true));
  }

  const rows = await db
    .select()
    .from(adminRosterShift)
    .where(and(...conditions))
    .orderBy(asc(adminRosterShift.shiftDate), asc(adminRosterShift.startTime));

  return rows.map((r) => ({
    id: r.id,
    shiftDate: r.shiftDate,
    staffEmail: r.staffEmail,
    staffName: r.staffName,
    startTime: r.startTime,
    endTime: r.endTime,
    published: r.published,
    createdBy: r.createdBy,
  }));
}

export async function createRosterShift(
  db: ReturnType<typeof getDb>,
  input: {
    shiftDate: string;
    staffEmail: string;
    staffName: string;
    startTime: string;
    endTime: string;
    published?: boolean;
    createdBy: string;
  },
): Promise<RosterShift> {
  const [row] = await db
    .insert(adminRosterShift)
    .values({
      shiftDate: input.shiftDate,
      staffEmail: input.staffEmail.trim().toLowerCase(),
      staffName: input.staffName,
      startTime: input.startTime,
      endTime: input.endTime,
      published: input.published ?? false,
      createdBy: input.createdBy,
      updatedAt: new Date(),
    })
    .returning();

  return {
    id: row.id,
    shiftDate: row.shiftDate,
    staffEmail: row.staffEmail,
    staffName: row.staffName,
    startTime: row.startTime,
    endTime: row.endTime,
    published: row.published,
    createdBy: row.createdBy,
  };
}

export async function deleteRosterShift(
  db: ReturnType<typeof getDb>,
  id: string,
): Promise<void> {
  await db.delete(adminRosterShift).where(eq(adminRosterShift.id, id));
}

export async function setMonthPublished(
  db: ReturnType<typeof getDb>,
  yearMonth: string,
  published: boolean,
): Promise<number> {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) return 0;
  const { year, month } = parsed;
  const startDate = formatCalendarDate(year, month, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = formatCalendarDate(year, month, lastDay);

  const updated = await db
    .update(adminRosterShift)
    .set({ published, updatedAt: new Date() })
    .where(
      and(
        gte(adminRosterShift.shiftDate, startDate),
        lte(adminRosterShift.shiftDate, endDate),
      ),
    )
    .returning({ id: adminRosterShift.id });

  return updated.length;
}

export type RosterAlert = {
  type: "conflict" | "no_admin_no_class" | "no_admin_has_class" | "missing_submission";
  date?: string;
  message: string;
  staffEmail?: string;
  shiftId?: string;
};

export async function computeRosterAlerts(
  db: ReturnType<typeof getDb>,
  yearMonth: string,
): Promise<{ alerts: RosterAlert[]; conflictCount: number; coverageGapCount: number }> {
  const parsed = parseYearMonth(yearMonth);
  if (!parsed) return { alerts: [], conflictCount: 0, coverageGapCount: 0 };

  const { year, month } = parsed;
  const startDate = formatCalendarDate(year, month, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = formatCalendarDate(year, month, lastDay);

  const [shifts, availability, staff, sessionRows] = await Promise.all([
    listRosterShifts(db, yearMonth),
    listAvailabilityForMonth(db, yearMonth),
    listActiveStaff(db),
    db
      .select({ date: classSessions.scheduledDate })
      .from(classSessions)
      .innerJoin(classes, eq(classSessions.classId, classes.id))
      .where(
        and(
          gte(classSessions.scheduledDate, startDate),
          lte(classSessions.scheduledDate, endDate),
          eq(classes.isActive, true),
        ),
      ),
  ]);

  const alerts: RosterAlert[] = [];
  const datesWithClass = new Set(sessionRows.map((r) => r.date));

  for (const shift of shifts) {
    const staffSlots = availability.filter(
      (a) =>
        a.staffEmail === shift.staffEmail && a.availDate === shift.shiftDate,
    );
    const covered = staffSlots.some((a) =>
      slotCoversShift(a, { startTime: shift.startTime, endTime: shift.endTime }),
    );
    if (!covered) {
      alerts.push({
        type: "conflict",
        date: shift.shiftDate,
        staffEmail: shift.staffEmail,
        shiftId: shift.id,
        message: `${shift.staffName || shift.staffEmail} is rostered ${shift.startTime}–${shift.endTime} on ${shift.shiftDate} but no longer marked available.`,
      });
    }
  }

  const publishedByDate = new Map<string, number>();
  for (const s of shifts.filter((x) => x.published)) {
    publishedByDate.set(s.shiftDate, (publishedByDate.get(s.shiftDate) ?? 0) + 1);
  }

  for (let d = 1; d <= lastDay; d++) {
    const iso = formatCalendarDate(year, month, d);
    const hasAdmin = (publishedByDate.get(iso) ?? 0) > 0;
    const hasClass = datesWithClass.has(iso);
    if (!hasAdmin && hasClass) {
      alerts.push({
        type: "no_admin_has_class",
        date: iso,
        message: `${iso}: classes scheduled but no published admin on duty.`,
      });
    } else if (!hasAdmin && !hasClass) {
      alerts.push({
        type: "no_admin_no_class",
        date: iso,
        message: `${iso}: no published admin (no classes this day).`,
      });
    }
  }

  const staffWithAvail = new Set(availability.map((a) => a.staffEmail));
  for (const s of staff) {
    if (!staffWithAvail.has(s.email)) {
      alerts.push({
        type: "missing_submission",
        staffEmail: s.email,
        message: `${s.displayName} has not entered availability for ${yearMonth}.`,
      });
    }
  }

  const conflictCount = alerts.filter((a) => a.type === "conflict").length;
  const coverageGapCount = alerts.filter(
    (a) => a.type === "no_admin_has_class" || a.type === "no_admin_no_class",
  ).length;

  return { alerts, conflictCount, coverageGapCount };
}
