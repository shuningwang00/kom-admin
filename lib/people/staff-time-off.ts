import type { getDb } from "@/lib/db/index";
import { staffTimeOff } from "@/lib/db/schema";
import { timeOffDatesInMonth } from "@/lib/people/time-off-dates";
import { and, asc, eq, gte, lte } from "drizzle-orm";

export type StaffTimeOffRecord = {
  id: string;
  staffEmail: string;
  startDate: string;
  endDate: string;
  reason: string;
  createdBy: string;
};

export async function listStaffTimeOff(
  db: ReturnType<typeof getDb>,
  staffEmail?: string,
): Promise<StaffTimeOffRecord[]> {
  const rows = await db
    .select()
    .from(staffTimeOff)
    .where(staffEmail ? eq(staffTimeOff.staffEmail, staffEmail) : undefined)
    .orderBy(asc(staffTimeOff.startDate));

  return rows.map((r) => ({
    id: r.id,
    staffEmail: r.staffEmail,
    startDate: r.startDate,
    endDate: r.endDate,
    reason: r.reason,
    createdBy: r.createdBy,
  }));
}

export async function createStaffTimeOff(
  db: ReturnType<typeof getDb>,
  params: {
    staffEmail: string;
    startDate: string;
    endDate: string;
    reason: string;
    createdBy: string;
  },
): Promise<StaffTimeOffRecord> {
  const email = params.staffEmail.trim().toLowerCase();
  const [row] = await db
    .insert(staffTimeOff)
    .values({
      staffEmail: email,
      startDate: params.startDate,
      endDate: params.endDate,
      reason: params.reason,
      createdBy: params.createdBy,
    })
    .returning();

  return {
    id: row.id,
    staffEmail: row.staffEmail,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
    createdBy: row.createdBy,
  };
}

export async function deleteStaffTimeOff(
  db: ReturnType<typeof getDb>,
  id: string,
): Promise<void> {
  await db.delete(staffTimeOff).where(eq(staffTimeOff.id, id));
}

export async function updateStaffTimeOff(
  db: ReturnType<typeof getDb>,
  id: string,
  params: { startDate: string; endDate: string; reason: string },
): Promise<StaffTimeOffRecord | null> {
  const [row] = await db
    .update(staffTimeOff)
    .set({
      startDate: params.startDate,
      endDate: params.endDate,
      reason: params.reason,
    })
    .where(eq(staffTimeOff.id, id))
    .returning();

  if (!row) return null;
  return {
    id: row.id,
    staffEmail: row.staffEmail,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
    createdBy: row.createdBy,
  };
}

/** Ranges overlapping a calendar month. */
export async function listStaffTimeOffForMonth(
  db: ReturnType<typeof getDb>,
  staffEmail: string,
  yearMonth: string,
): Promise<StaffTimeOffRecord[]> {
  const [y, m] = yearMonth.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const rows = await db
    .select()
    .from(staffTimeOff)
    .where(
      and(
        eq(staffTimeOff.staffEmail, staffEmail.trim().toLowerCase()),
        lte(staffTimeOff.startDate, monthEnd),
        gte(staffTimeOff.endDate, monthStart),
      ),
    )
    .orderBy(asc(staffTimeOff.startDate));

  return rows.map((r) => ({
    id: r.id,
    staffEmail: r.staffEmail,
    startDate: r.startDate,
    endDate: r.endDate,
    reason: r.reason,
    createdBy: r.createdBy,
  }));
}

export function datesBlockedByTimeOff(
  records: StaffTimeOffRecord[],
  yearMonth: string,
): Set<string> {
  return timeOffDatesInMonth(records, yearMonth);
}

/** All staff time-off ranges overlapping a calendar month. */
export async function listAllStaffTimeOffForMonth(
  db: ReturnType<typeof getDb>,
  yearMonth: string,
): Promise<StaffTimeOffRecord[]> {
  const [y, m] = yearMonth.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const rows = await db
    .select()
    .from(staffTimeOff)
    .where(
      and(
        lte(staffTimeOff.startDate, monthEnd),
        gte(staffTimeOff.endDate, monthStart),
      ),
    )
    .orderBy(asc(staffTimeOff.startDate));

  return rows.map((r) => ({
    id: r.id,
    staffEmail: r.staffEmail,
    startDate: r.startDate,
    endDate: r.endDate,
    reason: r.reason,
    createdBy: r.createdBy,
  }));
}

export function filterAvailabilityExcludingTimeOff<
  T extends { staffEmail: string; availDate: string },
>(slots: T[], timeOffRecords: StaffTimeOffRecord[], yearMonth: string): T[] {
  const byStaff = new Map<string, StaffTimeOffRecord[]>();
  for (const r of timeOffRecords) {
    const email = r.staffEmail.trim().toLowerCase();
    const list = byStaff.get(email) ?? [];
    list.push(r);
    byStaff.set(email, list);
  }
  return slots.filter((s) => {
    const email = s.staffEmail.trim().toLowerCase();
    const recs = byStaff.get(email);
    if (!recs?.length) return true;
    return !timeOffDatesInMonth(recs, yearMonth).has(s.availDate);
  });
}
