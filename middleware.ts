import { getAdminPassword } from "@/lib/config";
import {
  hasSessionCookieValue,
  SESSION_COOKIE,
} from "@/lib/auth/session";
import { isPdfDevPreviewEnabled } from "@/lib/pdf/dev-preview";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/api/auth/login") return true;
  if (pathname === "/api/auth/status") return true;
  if (pathname.startsWith("/api/auth/google")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (isPdfDevPreviewEnabled() && pathname.startsWith("/api/dev/pdf-preview")) {
    return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  // BILLING_ADMIN_PASSWORD set = require Google sign-in (kom_session), not the password value.
  const authGateEnabled = getAdminPassword();
  if (!authGateEnabled) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const sessionRaw = request.cookies.get(SESSION_COOKIE)?.value;
  if (hasSessionCookieValue(sessionRaw)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:jpg|jpeg|png|gif|svg|ico|webp|woff|woff2)).*)"],
};
