import { isOwnerEmail } from "@/lib/auth/config";
import { roleLabel } from "@/lib/auth/access";
import { hasSitePasswordAuth } from "@/lib/auth/password";
import { getEffectiveUser } from "@/lib/auth/user";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await hasSitePasswordAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getEffectiveUser();
    return NextResponse.json({
      user: user
        ? { ...user, roleLabel: roleLabel(user.role) }
        : null,
      isOwner: user ? isOwnerEmail(user.email) || user.role === "owner" : false,
      isMasterAdmin: user
        ? isOwnerEmail(user.email) || user.role === "owner"
        : false,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
