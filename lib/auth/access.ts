import type { SessionUser, UserRole } from "@/lib/auth/config";
import { hasSitePasswordAuth } from "@/lib/auth/password";
import {
  getEffectiveUser,
  getTutorMatch,
  tutorCanAccessClass,
} from "@/lib/auth/user";

export function isOwner(user: SessionUser): boolean {
  return user.role === "owner";
}

export function isStaff(user: SessionUser): boolean {
  return user.role === "staff";
}

export function isTutor(user: SessionUser): boolean {
  return user.role === "tutor";
}

/** Owner or office staff — all classes, billing, attendance. */
export function hasStaffPrivileges(user: SessionUser): boolean {
  return user.role === "owner" || user.role === "staff";
}

export async function requireSiteAccess(): Promise<void> {
  if (!(await hasSitePasswordAuth())) {
    throw new Error("Unauthorized");
  }
}

export async function requireEffectiveUser(): Promise<SessionUser> {
  await requireSiteAccess();
  const user = await getEffectiveUser();
  if (!user) {
    throw new Error(
      "Sign in with Google (owner, staff, or tutor) or use the site password.",
    );
  }
  return user;
}

export async function requireOwner(): Promise<SessionUser> {
  const user = await requireEffectiveUser();
  if (!isOwner(user)) {
    throw new Error("Owner access required.");
  }
  return user;
}

/** View students, classes, enrollments. */
export async function assertCanReadRoster(): Promise<SessionUser> {
  const user = await requireEffectiveUser();
  if (!hasStaffPrivileges(user)) {
    throw new Error("Roster access requires owner or staff role.");
  }
  return user;
}

/** Register students, update details, enroll / end enrollments. */
export async function assertCanManageStudents(): Promise<SessionUser> {
  return assertCanReadRoster();
}

/** Add or edit class definitions. */
export async function assertCanMutateClasses(): Promise<SessionUser> {
  const user = await requireEffectiveUser();
  if (!isOwner(user)) {
    throw new Error("Only the centre owner can add or edit classes.");
  }
  return user;
}

/** Billing dashboard, PDFs, mark INV. */
export async function assertCanUseBilling(): Promise<SessionUser> {
  const user = await requireEffectiveUser();
  if (!hasStaffPrivileges(user)) {
    throw new Error("Billing access requires owner or staff role.");
  }
  return user;
}

export async function assertCanAccessClass(
  classTutor: string,
): Promise<SessionUser> {
  const user = await requireEffectiveUser();
  if (hasStaffPrivileges(user)) return user;
  const match = await getTutorMatch(user.email);
  if (!tutorCanAccessClass(classTutor, match)) {
    throw new Error("You do not have access to this class.");
  }
  return user;
}

export async function assertCanMarkAttendance(
  classTutor: string,
): Promise<SessionUser> {
  return assertCanAccessClass(classTutor);
}

export async function assertCanScheduleMakeup(
  classTutor: string,
): Promise<SessionUser> {
  const user = await assertCanAccessClass(classTutor);
  if (!hasStaffPrivileges(user)) {
    throw new Error("Scheduling makeup requires owner or staff role.");
  }
  return user;
}

export function roleLabel(role: UserRole): string {
  if (role === "owner") return "Owner";
  if (role === "staff") return "Staff";
  return "Tutor";
}
