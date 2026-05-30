import { clearSessionCookie } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
