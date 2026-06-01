import { daysInMonth } from "@/lib/centre-hours";
import type { getDb } from "@/lib/db/index";
import { staffAvailability } from "@/lib/db/schema";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";

export type AvailabilitySlot = {
  id: string;
  staffEmail: string;
  availDate: string;
  startTime: string;
  endTime: string;
  slotLabel: string;
  note: string;
};

export async function listAvailabilityForMonth(
  db: ReturnType<typeof getDb>,
  yearMonth: string,
  staffEmail?: string,
): Promise<AvailabilitySlot[]> {
  const days = daysInMonth(yearMonth);
  if (days.length === 0) return [];
  const start = days[0];
  const end = days[days.length - 1];

  const conditions = [
    gte(staffAvailability.availDate, start),
    lte(staffAvailability.availDate, end),
  ];
  if (staffEmail) {
    conditions.push(eq(staffAvailability.staffEmail, staffEmail.trim().toLowerCase()));
  }

  const rows = await db
    .select()
    .from(staffAvailability)
    .where(and(...conditions))
    .orderBy(asc(staffAvailability.availDate), asc(staffAvailability.startTime));

  return rows.map((r) => ({
    id: r.id,
    staffEmail: r.staffEmail,
    availDate: r.availDate,
    startTime: r.startTime,
    endTime: r.endTime,
    slotLabel: r.slotLabel,
    note: r.note,
  }));
}

export async function replaceStaffMonthAvailability(
  db: ReturnType<typeof getDb>,
  staffEmail: string,
  yearMonth: string,
  slots: Array<{
    availDate: string;
    startTime: string;
    endTime: string;
    slotLabel?: string;
    note?: string;
  }>,
  opts?: { preserveAvailDates?: Iterable<string> },
): Promise<void> {
  const days = daysInMonth(yearMonth);
  const email = staffEmail.trim().toLowerCase();
  if (days.length === 0) return;

  const preserve = new Set(opts?.preserveAvailDates ?? []);
  const datesToReplace = days.filter((d) => !preserve.has(d));
  if (datesToReplace.length > 0) {
    await db
      .delete(staffAvailability)
      .where(
        and(
          eq(staffAvailability.staffEmail, email),
          inArray(staffAvailability.availDate, datesToReplace),
        ),
      );
  }

  if (slots.length === 0) return;

  await db.insert(staffAvailability).values(
    slots.map((s) => ({
      staffEmail: email,
      availDate: s.availDate,
      startTime: s.startTime,
      endTime: s.endTime,
      slotLabel: s.slotLabel ?? "",
      note: s.note ?? "",
      updatedAt: new Date(),
    })),
  );
}
