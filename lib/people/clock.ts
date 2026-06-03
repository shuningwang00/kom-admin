import { getDb } from "@/lib/db/index";
import { adminRosterShift, siteAllowlist, staffClockEntries } from "@/lib/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";

export type ClockEntry = typeof staffClockEntries.$inferSelect;

export type StaffMember = {
  email: string;
  displayName: string;
  fullName: string;
  hourlyRate: string;
};

/** Minutes between two HH:MM strings. Returns 0 if end <= start. */
export function computeHours(start: string, end: string): number {
  const parse = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  return Math.max(0, (parse(end) - parse(start)) / 60);
}

export async function listClockableStaff(): Promise<StaffMember[]> {
  const db = getDb();
  const rows = await db
    .select({
      email: siteAllowlist.email,
      displayName: siteAllowlist.displayName,
      fullName: siteAllowlist.fullName,
      hourlyRate: siteAllowlist.hourlyRate,
    })
    .from(siteAllowlist)
    .where(
      and(
        eq(siteAllowlist.isActive, true),
      ),
    )
    .orderBy(asc(siteAllowlist.displayName));
  // Only staff/staff_tutor roles clock in (not pure tutors or relief_tutors)
  return rows.filter((r) => {
    // hourlyRate is only set for staff — or include all active users and let the UI filter
    return true;
  });
}

export async function listClockEntriesForMonth(
  yearMonth: string,
  staffEmail?: string,
): Promise<ClockEntry[]> {
  const [y, m] = yearMonth.split("-").map(Number);
  const startDate = `${yearMonth}-01`;
  const endDate = `${yearMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  const db = getDb();
  return db
    .select()
    .from(staffClockEntries)
    .where(
      and(
        gte(staffClockEntries.entryDate, startDate),
        lte(staffClockEntries.entryDate, endDate),
        staffEmail ? eq(staffClockEntries.staffEmail, staffEmail) : undefined,
      ),
    )
    .orderBy(asc(staffClockEntries.entryDate), asc(staffClockEntries.startTime));
}

export async function createClockEntry(data: {
  staffEmail: string;
  staffName: string;
  entryDate: string;
  startTime: string;
  endTime: string;
  notes: string;
  createdBy: string;
}): Promise<ClockEntry> {
  const db = getDb();
  const [row] = await db
    .insert(staffClockEntries)
    .values(data)
    .returning();
  return row;
}

export async function updateClockEntry(
  id: string,
  data: Partial<{
    startTime: string;
    endTime: string;
    notes: string;
    entryDate: string;
  }>,
): Promise<ClockEntry | undefined> {
  const db = getDb();
  const [row] = await db
    .update(staffClockEntries)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(staffClockEntries.id, id))
    .returning();
  return row;
}

export async function deleteClockEntry(id: string): Promise<void> {
  const db = getDb();
  await db.delete(staffClockEntries).where(eq(staffClockEntries.id, id));
}

export async function getClockEntry(id: string): Promise<ClockEntry | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(staffClockEntries)
    .where(eq(staffClockEntries.id, id))
    .limit(1);
  return row;
}

export async function getTodayRosterShift(
  staffEmail: string,
  today: string,
): Promise<{ startTime: string; endTime: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ startTime: adminRosterShift.startTime, endTime: adminRosterShift.endTime })
    .from(adminRosterShift)
    .where(
      and(
        eq(adminRosterShift.staffEmail, staffEmail),
        eq(adminRosterShift.shiftDate, today),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getStaffMember(email: string): Promise<StaffMember | null> {
  const db = getDb();
  const [row] = await db
    .select({
      email: siteAllowlist.email,
      displayName: siteAllowlist.displayName,
      fullName: siteAllowlist.fullName,
      hourlyRate: siteAllowlist.hourlyRate,
    })
    .from(siteAllowlist)
    .where(eq(siteAllowlist.email, email))
    .limit(1);
  return row ?? null;
}

export async function updateStaffHourlyRate(email: string, hourlyRate: string): Promise<void> {
  const db = getDb();
  await db
    .update(siteAllowlist)
    .set({ hourlyRate })
    .where(eq(siteAllowlist.email, email));
}
