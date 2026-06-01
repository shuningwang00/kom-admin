import type { SessionUser } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/index";
import { siteAllowlist } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type EffectiveUser = SessionUser;

/** Signed-in Google user (allowlist + owner email). */
export async function getEffectiveUser(): Promise<EffectiveUser | null> {
  return getSessionUser();
}

/**
 * Returns the tutor's schedule name (e.g. "JUNYANG").
 * Accepts either a full SessionUser (uses cached tutorMatch — no DB hit) or a raw email string.
 */
export async function getTutorMatch(emailOrUser: string | SessionUser): Promise<string> {
  if (typeof emailOrUser !== "string") {
    return emailOrUser.tutorMatch?.trim() ?? "";
  }
  const email = emailOrUser;
  if (email === "owner@site") return "";
  const db = getDb();
  const [row] = await db
    .select({ tutorMatch: siteAllowlist.tutorMatch })
    .from(siteAllowlist)
    .where(eq(siteAllowlist.email, email.trim().toLowerCase()))
    .limit(1);
  return row?.tutorMatch?.trim() ?? "";
}

export function tutorCanAccessClass(
  classTutor: string,
  tutorMatch: string,
): boolean {
  const match = tutorMatch.trim();
  if (!match) return false;
  return classTutor.toLowerCase().includes(match.toLowerCase());
}
