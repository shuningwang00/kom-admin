import { isOwnerEmail } from "@/lib/auth/config";
import { isReliefTutor, roleLabel } from "@/lib/auth/access";
import { RELIEF_TUTOR_PERMISSIONS } from "@/lib/auth/relief-tutor";
import { getEffectiveUser } from "@/lib/auth/user";
import { getDb } from "@/lib/db/index";
import { loadPermissions } from "@/lib/settings/permissions";
import type { AppPermissions } from "@/lib/settings/permissions";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    // Parallelize: user session lookup and global permissions load are independent.
    const [user, globalPerms] = await Promise.all([
      getEffectiveUser(),
      loadPermissions(db),
    ]);

    const isOwner = user ? isOwnerEmail(user.email) || user.role === "owner" : false;

    let permissions: AppPermissions = globalPerms;
    if (user && isReliefTutor(user)) {
      permissions = {
        tutor: RELIEF_TUTOR_PERMISSIONS,
        staff: globalPerms.staff,
      };
    } else if (user && !isOwner && (user.role === "tutor" || user.role === "staff")) {
      // permissionsJson is already on the user object from the session resolution — no extra DB hit.
      let userOverride: Record<string, boolean> = {};
      if (user.permissionsJson) {
        try { userOverride = JSON.parse(user.permissionsJson) as Record<string, boolean>; } catch {}
      }
      permissions = {
        tutor: user.role === "tutor" ? { ...globalPerms.tutor, ...userOverride } : globalPerms.tutor,
        staff: user.role === "staff" ? { ...globalPerms.staff, ...userOverride } : globalPerms.staff,
      };
    }

    const ar = user?.allowlistRole;
    const peopleTabs = {
      timeOff:
        isOwner ||
        ar === "staff" ||
        ar === "tutor" ||
        ar === "staff_tutor",
      availability:
        isOwner || ar === "staff" || ar === "staff_tutor",
      adminRoster: isOwner,
      payroll: Boolean(user),
    };

    return NextResponse.json({
      user: user ? { ...user, roleLabel: roleLabel(user.role) } : null,
      isOwner,
      isMasterAdmin: isOwner,
      permissions,
      peopleTabs,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
