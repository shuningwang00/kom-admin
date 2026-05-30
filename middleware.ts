import { getAdminPassword } from "@/lib/config";
import { isPdfDevPreviewEnabled } from "@/lib/pdf/dev-preview";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "kom_billing_auth";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/api/auth/login") return true;
  if (pathname === "/api/auth/status") return true;
  if (pathname.startsWith("/api/auth/google")) return true;
  if (isPdfDevPreviewEnabled() && pathname.startsWith("/api/dev/pdf-preview")) {
    return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  const password = getAdminPassword();
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const authed = request.cookies.get(AUTH_COOKIE)?.value === "1";
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
