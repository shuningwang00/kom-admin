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

/** owner = you · staff = office admin · tutor = teacher */
export type UserRole = "owner" | "staff" | "tutor";

export type SessionUser = {
  email: string;
  role: UserRole;
  displayName: string;
};
