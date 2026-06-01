import { isOwnerEmail } from "@/lib/auth/config";
import { roleLabel } from "@/lib/auth/access";
import { getEffectiveUser } from "@/lib/auth/user";
import { getDb } from "@/lib/db/index";
import { loadPermissions, resolveUserPermissions } from "@/lib/settings/permissions";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getEffectiveUser();
    const db = getDb();
    const globalPerms = await loadPermissions(db);
    const isOwner = user ? isOwnerEmail(user.email) || user.role === "owner" : false;

    const permissions =
      user && !isOwner && (user.role === "tutor" || user.role === "staff")
        ? await resolveUserPermissions(db, user.email, user.role, globalPerms)
        : globalPerms;

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
