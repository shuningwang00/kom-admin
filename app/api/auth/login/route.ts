import { getAdminPassword } from "@/lib/config";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const password = getAdminPassword();
  if (!password) {
    return NextResponse.json({ success: true, authRequired: false });
  }

  const body = await request.json();
  if (body.password !== password) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ success: true, authRequired: true });
  res.cookies.set("kom_billing_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
