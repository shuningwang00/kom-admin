import type { AllowlistRole } from "@/lib/auth/config";
import type { TutorPermissions } from "@/lib/settings/permissions";

/** Fixed portal access for relief-only tutors (not configurable per user). */
export const RELIEF_TUTOR_PERMISSIONS: TutorPermissions = {
  viewCalendar: true,
  viewPeople: false,
  viewByDay: false,
  viewStudents: false,
};

export const RELIEF_TUTOR_PERMISSIONS_JSON = JSON.stringify(
  RELIEF_TUTOR_PERMISSIONS,
);

export function isReliefAllowlistRole(
  role: AllowlistRole | string | undefined,
): boolean {
  return role === "relief_tutor";
}
