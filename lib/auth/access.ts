import type { SessionUser, UserRole } from "@/lib/auth/config";
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

export function isReliefTutor(user: SessionUser): boolean {
  return user.role === "relief_tutor";
}

/** Regular or relief tutor — class-scoped attendance, not full staff. */
export function isTutorLike(user: SessionUser): boolean {
  return user.role === "tutor" || user.role === "relief_tutor";
}

/** Owner or office staff — all classes, billing, attendance. */
export function hasStaffPrivileges(user: SessionUser): boolean {
  return user.role === "owner" || user.role === "staff";
}

export async function requireEffectiveUser(): Promise<SessionUser> {
  const user = await getEffectiveUser();
  if (!user) {
    throw new Error(
      "Sign in with Google using an email on Team access (owner, staff, or tutor).",
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
  if (!isTutorLike(user)) {
    throw new Error("You do not have access to this class.");
  }
  const match = await getTutorMatch(user.email);
  if (!tutorCanAccessClass(classTutor, match)) {
    throw new Error("You do not have access to this class.");
  }
  return user;
}

export async function assertCanMarkAttendance(
  classTutor: string,
  reliefTutor = "",
): Promise<SessionUser> {
  const user = await requireEffectiveUser();
  if (hasStaffPrivileges(user)) return user;
  if (!isTutorLike(user)) {
    throw new Error("You do not have access to this class.");
  }
  const match = await getTutorMatch(user.email);
  if (tutorCanAccessClass(classTutor, match)) return user;
  if (reliefTutor && tutorCanAccessClass(reliefTutor, match)) return user;
  throw new Error("You do not have access to this class.");
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

/** Makeup hub — needs scheduling + all scheduled makeups. */
export async function assertCanAccessMakeupHub(): Promise<SessionUser> {
  const user = await requireEffectiveUser();
  if (!hasStaffPrivileges(user)) {
    throw new Error("Makeup hub requires owner or staff role.");
  }
  return user;
}

export function roleLabel(role: UserRole): string {
  if (role === "owner") return "Owner";
  if (role === "staff") return "Staff";
  if (role === "relief_tutor") return "Relief tutor";
  return "Tutor";
}
