import type { SessionUser } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import { hasSitePasswordAuth } from "@/lib/auth/password";
import { getDb } from "@/lib/db/index";
import { siteAllowlist } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type EffectiveUser = SessionUser;

/** Google session, or site password as owner (on-duty). */
export async function getEffectiveUser(): Promise<EffectiveUser | null> {
  const session = await getSessionUser();
  if (session) return session;
  if (await hasSitePasswordAuth()) {
    return {
      email: "owner@site",
      role: "owner",
      displayName: "Owner",
    };
  }
  return null;
}

export async function getTutorMatch(email: string): Promise<string> {
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
