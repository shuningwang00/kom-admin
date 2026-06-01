import type { getDb } from "@/lib/db/index";
import { siteAllowlist } from "@/lib/db/schema";
import { and, asc, eq, or } from "drizzle-orm";

export type StaffMember = {
  email: string;
  displayName: string;
  fullName: string;
};

export async function listActiveStaff(db: ReturnType<typeof getDb>): Promise<StaffMember[]> {
  const rows = await db
    .select({
      email: siteAllowlist.email,
      displayName: siteAllowlist.displayName,
      fullName: siteAllowlist.fullName,
    })
    .from(siteAllowlist)
    .where(
      and(
        eq(siteAllowlist.isActive, true),
        or(
          eq(siteAllowlist.role, "staff"),
          eq(siteAllowlist.role, "staff_tutor"),
        ),
      ),
    )
    .orderBy(asc(siteAllowlist.fullName));

  return rows.map((r) => ({
    email: r.email,
    displayName: r.displayName?.trim() || r.fullName?.trim() || r.email,
    fullName: r.fullName?.trim() || r.displayName?.trim() || r.email,
  }));
}

export function staffDisplayName(
  member: StaffMember | undefined,
  email: string,
): string {
  return member?.displayName || member?.fullName || email;
}
