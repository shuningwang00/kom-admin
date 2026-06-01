import type { getDb } from "@/lib/db/index";
import { siteSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type TutorPermissions = {
  viewCalendar: boolean;
  viewPeople: boolean;
  viewByDay: boolean;
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
