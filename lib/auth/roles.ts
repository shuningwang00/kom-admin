import type { UserRole } from "@/lib/auth/config";

export function normalizeLegacyRole(role: string): UserRole | null {
  if (role === "owner") return "owner";
  if (role === "staff") return "staff";
  if (role === "tutor" || role === "teacher") return "tutor";
  /** Old builds used "admin" for both owner and staff; re-resolve from email in session. */
  if (role === "admin") return null;
  return null;
}
