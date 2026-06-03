import { jsonError, jsonOk } from "@/lib/api/json";
import {
  hasStaffPrivileges,
  isOwner,
  isOwnerOrAdmin,
  isTutor,
  requireEffectiveUser,
} from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { dbErrorMessage } from "@/lib/db/query-error";
import {
  createStaffTimeOff,
  listStaffTimeOff,
} from "@/lib/people/staff-time-off";
import { listStaffTimeOffTargets } from "@/lib/people/staff-list";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireEffectiveUser();
    const { searchParams } = new URL(request.url);
    const staffEmailParam = searchParams.get("staffEmail")?.trim().toLowerCase();

    const db = getDb();
    if (await isOwnerOrAdmin(user)) {
      const staff = await listStaffTimeOffTargets(db);
      if (!staffEmailParam) {
        return jsonOk({ records: [], staff, staffEmail: null, actingAsOwner: true });
      }
      if (!staff.some((s) => s.email === staffEmailParam)) {
        return jsonError("Team member not found.", 404);
      }
      const records = await listStaffTimeOff(db, staffEmailParam);
      return jsonOk({
        records,
        staff,
        staffEmail: staffEmailParam,
        actingAsOwner: true,
      });
    }

    if (isTutor(user) && !hasStaffPrivileges(user)) {
      return jsonError("Staff access required.", 403);
    }

    const email = user.email.trim().toLowerCase();
    const records = await listStaffTimeOff(db, email);
    return jsonOk({ records, staffEmail: email, actingAsOwner: false });
  } catch (err) {
    return jsonError(dbErrorMessage(err), apiErrorStatus(err));
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireEffectiveUser();
    const body = (await request.json()) as Record<string, unknown>;
    const startDate = String(body.startDate ?? "").trim();
    const endDate = String(body.endDate ?? "").trim();
    const reason = String(body.reason ?? "").trim();

    if (!startDate || !endDate) {
      return jsonError("startDate and endDate are required.", 400);
    }
    if (endDate < startDate) {
      return jsonError("endDate must be on or after startDate.", 400);
    }

    const db = getDb();
    let staffEmail = user.email.trim().toLowerCase();

    if (await isOwnerOrAdmin(user)) {
      const picked = String(body.staffEmail ?? "").trim().toLowerCase();
      if (!picked) return jsonError("Select a team member.", 400);
      const staff = await listStaffTimeOffTargets(db);
      if (!staff.some((s) => s.email === picked)) {
        return jsonError("Team member not found.", 404);
      }
      staffEmail = picked;
    } else if (!hasStaffPrivileges(user)) {
      return jsonError("Staff access required.", 403);
    }

    const record = await createStaffTimeOff(db, {
      staffEmail,
      startDate,
      endDate,
      reason,
      createdBy: user.email,
    });

    return jsonOk({ record }, 201);
  } catch (err) {
    return jsonError(dbErrorMessage(err), apiErrorStatus(err));
  }
}

function apiErrorStatus(err: unknown): number {
  const msg = err instanceof Error ? err.message : "";
  if (/required|sign in|forbidden|staff access/i.test(msg)) return 403;
  return 500;
}
