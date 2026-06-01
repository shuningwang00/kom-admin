import { jsonError, jsonOk } from "@/lib/api/json";
import { isOwner, requireEffectiveUser } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import {
  createRosterShift,
  listRosterShifts,
  setMonthPublished,
} from "@/lib/people/admin-roster";
import { staffDisplayName, listActiveStaff } from "@/lib/people/staff-list";
import { listAvailabilityForMonth } from "@/lib/people/staff-availability";
import { listAllStaffTimeOffForMonth } from "@/lib/people/staff-time-off";
import { memberListLabel } from "@/lib/people/staff-list";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireEffectiveUser();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month")?.trim();
    if (!month) return jsonError("month=YYYY-MM required.", 400);

    const db = getDb();
    const shifts = await listRosterShifts(db, month, {
      publishedOnly: !isOwner(user),
    });

    if (!isOwner(user)) {
      return jsonOk({ month, shifts });
    }

    const [availability, staffMembers, staffTimeOff] = await Promise.all([
      listAvailabilityForMonth(db, month),
      listActiveStaff(db),
      listAllStaffTimeOffForMonth(db, month),
    ]);

    const staff = staffMembers.map((m) => ({
      email: m.email,
      displayName: memberListLabel(m),
    }));

    return jsonOk({ month, shifts, availability, staff, staffTimeOff });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 403);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireEffectiveUser();
    if (!isOwner(user)) return jsonError("Owner access required.", 403);

    const body = (await request.json()) as Record<string, unknown>;
    const shiftDate = String(body.shiftDate ?? "").trim();
    const staffEmail = String(body.staffEmail ?? "").trim().toLowerCase();
    const startTime = String(body.startTime ?? "").trim();
    const endTime = String(body.endTime ?? "").trim();
    const published = Boolean(body.published);

    if (!shiftDate || !staffEmail || !startTime || !endTime) {
      return jsonError("shiftDate, staffEmail, startTime, endTime required.", 400);
    }
    if (endTime <= startTime) {
      return jsonError("endTime must be after startTime.", 400);
    }

    const db = getDb();
    const staff = await listActiveStaff(db);
    const member = staff.find((s) => s.email === staffEmail);
    const staffName = staffDisplayName(member, staffEmail);

    const shift = await createRosterShift(db, {
      shiftDate,
      staffEmail,
      staffName,
      startTime,
      endTime,
      published,
      createdBy: user.email,
    });

    return jsonOk({ shift }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, 403);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireEffectiveUser();
    if (!isOwner(user)) return jsonError("Owner access required.", 403);

    const body = (await request.json()) as { month?: string; publish?: boolean };
    const month = body.month?.trim();
    if (!month) return jsonError("month required.", 400);

    const db = getDb();
    const count = await setMonthPublished(db, month, Boolean(body.publish));
    return jsonOk({ month, published: Boolean(body.publish), count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, 403);
  }
}
