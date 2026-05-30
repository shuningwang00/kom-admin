import { getAdminPassword } from "@/lib/config";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const password = getAdminPassword();
  if (!password) {
    return NextResponse.json({ authRequired: false });
  }
  const jar = await cookies();
  const authed = jar.get("kom_billing_auth")?.value === "1";
  return NextResponse.json({ authRequired: true, authed });
}
