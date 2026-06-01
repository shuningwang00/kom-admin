import type { getDb } from "@/lib/db/index";
import { siteAllowlist, siteSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type TutorPermissions = {
  viewCalendar: boolean;
  viewPeople: boolean;
  viewByDay: boolean;
  viewStudents: boolean;
};

export type StaffPermissions = {
  generateSessions: boolean;
};

export type AppPermissions = {
  tutor: TutorPermissions;
  staff: StaffPermissions;
};

export const DEFAULT_PERMISSIONS: AppPermissions = {
  tutor: {
    viewCalendar: false,
    viewPeople: false,
    viewByDay: false,
    viewStudents: false,
  },
  staff: {
    generateSessions: false,
  },
};

const SETTINGS_KEY = "app_permissions";

export async function loadPermissions(
  db: ReturnType<typeof getDb>,
): Promise<AppPermissions> {
  try {
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, SETTINGS_KEY))
      .limit(1);

    if (!row?.value) return DEFAULT_PERMISSIONS;

    const parsed = JSON.parse(row.value) as Partial<AppPermissions>;
    return {
      tutor: { ...DEFAULT_PERMISSIONS.tutor, ...parsed.tutor },
      staff: { ...DEFAULT_PERMISSIONS.staff, ...parsed.staff },
    };
  } catch {
    return DEFAULT_PERMISSIONS;
  }
}

export async function savePermissions(
  db: ReturnType<typeof getDb>,
  perms: AppPermissions,
): Promise<void> {
  const value = JSON.stringify(perms);
  await db
    .insert(siteSettings)
    .values({ key: SETTINGS_KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

/**
 * Returns the effective permissions for a specific user, merging role-level defaults
 * with any per-user overrides stored in siteAllowlist.permissionsJson.
 * Owner role bypasses this — always treated as having full access.
 */
export async function resolveUserPermissions(
  db: ReturnType<typeof getDb>,
  email: string,
  role: "tutor" | "staff",
  globalPerms: AppPermissions,
): Promise<AppPermissions> {
  const [row] = await db
    .select({ permissionsJson: siteAllowlist.permissionsJson })
    .from(siteAllowlist)
    .where(eq(siteAllowlist.email, email.trim().toLowerCase()))
    .limit(1);

  let userOverride: Record<string, boolean> = {};
  if (row?.permissionsJson) {
    try { userOverride = JSON.parse(row.permissionsJson) as Record<string, boolean>; } catch {}
  }

  return {
    tutor: role === "tutor" ? { ...globalPerms.tutor, ...userOverride } : globalPerms.tutor,
    staff: role === "staff" ? { ...globalPerms.staff, ...userOverride } : globalPerms.staff,
  };
}
