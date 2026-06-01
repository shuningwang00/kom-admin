import { getEffectiveUser } from "@/lib/auth/user";
import { getAdminPassword } from "@/lib/config";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getEffectiveUser();
  return NextResponse.json({
    authRequired: Boolean(getAdminPassword()),
    signedIn: Boolean(user),
  });
}
