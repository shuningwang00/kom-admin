import type { SessionUser, UserRole } from "@/lib/auth/config";
import { isOwnerEmail } from "@/lib/auth/config";
import { normalizeLegacyRole } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/index";
import { siteAllowlist } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "kom_session";

/** Middleware / edge: cookie present (full validation is server-side). */
export function hasSessionCookieValue(raw: string | undefined): boolean {
  return Boolean(raw?.trim());
}

export async function resolveRoleForEmail(
  email: string,
): Promise<UserRole | null> {
  const normalized = email.trim().toLowerCase();
  if (isOwnerEmail(normalized)) return "owner";

  const db = getDb();
  const [row] = await db
    .select({ role: siteAllowlist.role })
    .from(siteAllowlist)
    .where(
      and(
        eq(siteAllowlist.email, normalized),
        eq(siteAllowlist.isActive, true),
      ),
    )
    .limit(1);

  if (!row) return null;
  if (row.role === "staff" || row.role === "staff_tutor") return "staff";
  return "tutor";
}

export async function setSessionCookie(user: SessionUser) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionUser & { role: string };
    if (!parsed.email) return null;

    const role = await resolveRoleForEmail(parsed.email);
    if (!role) return null;

    return {
      email: parsed.email.toLowerCase(),
      role,
      displayName: parsed.displayName ?? "",
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Sign in with Google (owner, staff, or tutor allowlist).");
  }
  return user;
}

/** @deprecated Use requireOwner */
export async function requireMasterAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (!isOwnerEmail(user.email)) {
    throw new Error("Owner access required.");
  }
  return user;
}
