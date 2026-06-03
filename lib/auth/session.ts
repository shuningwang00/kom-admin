import type { AllowlistRole, SessionUser, UserRole } from "@/lib/auth/config";
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

type AllowlistResolved = {
  role: UserRole;
  allowlistRole: AllowlistRole | "owner";
  tutorMatch: string;
  permissionsJson: string;
};

const _allowlistCache = new Map<string, { value: AllowlistResolved | null; expiresAt: number }>();
const ALLOWLIST_TTL = 60_000;

export function invalidateAllowlistCache(email: string) {
  _allowlistCache.delete(email.trim().toLowerCase());
}

async function resolveFromAllowlist(email: string): Promise<AllowlistResolved | null> {
  if (isOwnerEmail(email)) {
    return { role: "owner", allowlistRole: "owner", tutorMatch: "", permissionsJson: "" };
  }

  const cached = _allowlistCache.get(email);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const db = getDb();
  const [row] = await db
    .select({
      role: siteAllowlist.role,
      tutorMatch: siteAllowlist.tutorMatch,
      permissionsJson: siteAllowlist.permissionsJson,
    })
    .from(siteAllowlist)
    .where(and(eq(siteAllowlist.email, email), eq(siteAllowlist.isActive, true)))
    .limit(1);

  let value: AllowlistResolved | null = null;
  if (row) {
    const allowlistRole = row.role as AllowlistRole;
    let role: UserRole;
    if (allowlistRole === "staff" || allowlistRole === "staff_tutor") {
      role = "staff";
    } else if (allowlistRole === "relief_tutor") {
      role = "relief_tutor";
    } else {
      role = "tutor";
    }
    value = {
      role,
      allowlistRole,
      tutorMatch: row.tutorMatch ?? "",
      permissionsJson: row.permissionsJson ?? "",
    };
  }

  _allowlistCache.set(email, { value, expiresAt: Date.now() + ALLOWLIST_TTL });
  return value;
}

/** @deprecated use resolveFromAllowlist */
export async function resolveRoleForEmail(email: string): Promise<UserRole | null> {
  const resolved = await resolveFromAllowlist(email.trim().toLowerCase());
  return resolved?.role ?? null;
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
    const parsed = JSON.parse(raw) as { email?: string; displayName?: string };
    if (!parsed.email) return null;

    const resolved = await resolveFromAllowlist(parsed.email.trim().toLowerCase());
    if (!resolved) return null;

    return {
      email: parsed.email.toLowerCase(),
      role: resolved.role,
      displayName: parsed.displayName ?? "",
      tutorMatch: resolved.tutorMatch,
      permissionsJson: resolved.permissionsJson,
      allowlistRole: resolved.allowlistRole,
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
