import { AUTH_COOKIE } from "@/lib/auth/password";
import { clearSessionCookie } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function POST() {
  await clearSessionCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
