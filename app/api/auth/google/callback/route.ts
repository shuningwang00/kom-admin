import { AUTH_COOKIE } from "@/lib/auth/password";
import { resolveRoleForEmail, setSessionCookie } from "@/lib/auth/session";
import {
  exchangeCodeForTokens,
  fetchGoogleProfile,
  setRefreshTokenCookie,
  type GoogleAuthMode,
} from "@/lib/google/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const mode = (searchParams.get("state") ?? "sheets") as GoogleAuthMode;

  const base = new URL(request.url);
  base.pathname = mode === "signin" ? "/students" : "/billing";
  base.search = "";

  if (error) {
    base.searchParams.set("google_error", error);
    return NextResponse.redirect(base);
  }

  if (!code) {
    base.searchParams.set("google_error", "missing_code");
    return NextResponse.redirect(base);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (tokens.refresh_token) {
      await setRefreshTokenCookie(tokens.refresh_token);
    }

    if (mode === "signin" && tokens.access_token) {
      const profile = await fetchGoogleProfile(tokens.access_token);
      const role = await resolveRoleForEmail(profile.email);
      if (!role) {
        base.pathname = "/login";
        base.searchParams.set(
          "google_error",
          "not_allowlisted",
        );
        return NextResponse.redirect(base);
      }
      await setSessionCookie({
        email: profile.email,
        role,
        displayName: profile.name,
      });
      base.searchParams.set("signed_in", "1");
    } else if (mode === "sheets") {
      base.searchParams.set("google_connected", "1");
    }

    const res = NextResponse.redirect(base);
    res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_failed";
    base.searchParams.set("google_error", message);
    return NextResponse.redirect(base);
  }
}
