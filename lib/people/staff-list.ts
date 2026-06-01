import type { getDb } from "@/lib/db/index";
import { siteAllowlist } from "@/lib/db/schema";
import { and, asc, eq, or } from "drizzle-orm";

export type StaffMember = {
  email: string;
  displayName: string;
  fullName: string;
  role?: "staff" | "tutor" | "staff_tutor";
  tutorMatch?: string;
};

export function memberRoleLabel(role: StaffMember["role"]): string {
  if (role === "staff_tutor") return "Staff & tutor";
  if (role === "tutor") return "Tutor";
  if (role === "staff") return "Staff";
  return "";
}

/** Active team members who can have staff (admin-duty) time off logged. */
export async function listStaffTimeOffTargets(
  db: ReturnType<typeof getDb>,
): Promise<StaffMember[]> {
  const rows = await db
    .select({
      email: siteAllowlist.email,
      displayName: siteAllowlist.displayName,
      fullName: siteAllowlist.fullName,
      role: siteAllowlist.role,
      tutorMatch: siteAllowlist.tutorMatch,
    })
    .from(siteAllowlist)
    .where(
      and(
        eq(siteAllowlist.isActive, true),
        or(
          eq(siteAllowlist.role, "staff"),
          eq(siteAllowlist.role, "staff_tutor"),
          eq(siteAllowlist.role, "tutor"),
        ),
      ),
    )
    .orderBy(asc(siteAllowlist.fullName));

  return rows.map((r) => mapStaffRow(r));
}

function mapStaffRow(r: {
  email: string;
  displayName: string | null;
  fullName: string | null;
  role: string;
  tutorMatch?: string | null;
}): StaffMember {
  return {
    email: r.email,
    displayName: r.displayName?.trim() || "",
    fullName: r.fullName?.trim() || r.displayName?.trim() || r.email,
    role: r.role as StaffMember["role"],
    tutorMatch: r.tutorMatch?.trim() || "",
  };
}

/** People / time off — display name, else schedule name (tutor match), else email. */
export function memberPersonLabel(
  m: Pick<StaffMember, "displayName" | "email" | "tutorMatch">,
): string {
  const display = m.displayName.trim();
  if (display) return display;
  const schedule = m.tutorMatch?.trim();
  if (schedule) return schedule;
  return m.email;
}

/** Dropdowns and roster messages — display name, schedule name, full name, email. */
export function memberListLabel(m: StaffMember): string {
  return m.displayName || m.tutorMatch || m.fullName || m.email;
}

export async function listActiveStaff(db: ReturnType<typeof getDb>): Promise<StaffMember[]> {
  const rows = await db
    .select({
      email: siteAllowlist.email,
      displayName: siteAllowlist.displayName,
      fullName: siteAllowlist.fullName,
      role: siteAllowlist.role,
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

  return rows.map((r) => mapStaffRow({ ...r, tutorMatch: "" }));
}

export function staffDisplayName(
  member: StaffMember | undefined,
  email: string,
): string {
  return member ? memberListLabel(member) : email;
}

/** JSON for client dropdowns (availability, time off). */
export function staffOptionForApi(m: StaffMember): {
  email: string;
  displayName: string;
  role?: StaffMember["role"];
} {
  return {
    email: m.email,
    displayName: memberListLabel(m),
    role: m.role,
  };
}

/** JSON for time off owner picker — display_name only, else email. */
export function timeOffPersonForApi(m: StaffMember): {
  email: string;
  displayName: string;
  role?: StaffMember["role"];
} {
  return {
    email: m.email,
    displayName: memberPersonLabel(m),
    role: m.role,
  };
}
