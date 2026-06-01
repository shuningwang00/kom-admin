export function getOwnerEmail(): string {
  return (
    process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase() ??
    "shuning.wang.00@gmail.com"
  );
}

/** Centre owner — full control (you). */
export function isOwnerEmail(email: string): boolean {
  return email.trim().toLowerCase() === getOwnerEmail();
}

/** @deprecated Use isOwnerEmail */
export function isMasterAdminEmail(email: string): boolean {
  return isOwnerEmail(email);
}

/** owner = you · staff = office admin · tutor = teacher · relief_tutor = cover-only */
export type UserRole = "owner" | "staff" | "tutor" | "relief_tutor";

export type AllowlistRole = "staff" | "tutor" | "staff_tutor" | "relief_tutor";

export type SessionUser = {
  email: string;
  role: UserRole;
  displayName: string;
  /** Populated from siteAllowlist on every session resolution — avoids extra DB round-trips. */
  tutorMatch?: string;
  permissionsJson?: string;
  allowlistRole?: AllowlistRole | "owner";
};
