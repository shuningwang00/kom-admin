import { isOwnerEmail } from "@/lib/auth/config";
import { roleLabel } from "@/lib/auth/access";
import { hasSitePasswordAuth } from "@/lib/auth/password";
import { getEffectiveUser } from "@/lib/auth/user";
import { getDb } from "@/lib/db/index";
import { loadPermissions } from "@/lib/settings/permissions";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await hasSitePasswordAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await getEffectiveUser();
    const db = getDb();
    const permissions = await loadPermissions(db);
    const isOwner = user ? isOwnerEmail(user.email) || user.role === "owner" : false;
    return NextResponse.json({
      user: user ? { ...user, roleLabel: roleLabel(user.role) } : null,
      isOwner,
      isMasterAdmin: isOwner,
      permissions,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
