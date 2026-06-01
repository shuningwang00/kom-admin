import { jsonError, jsonOk } from "@/lib/api/json";
import { isOwner, requireEffectiveUser } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import {
  deleteRosterShift,
  updateRosterShift,
} from "@/lib/people/admin-roster";
import { staffDisplayName, listActiveStaff } from "@/lib/people/staff-list";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireEffectiveUser();
    if (!isOwner(user)) return jsonError("Owner access required.", 403);

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const shiftDate = String(body.shiftDate ?? "").trim();
    const staffEmail = String(body.staffEmail ?? "").trim().toLowerCase();
    const startTime = String(body.startTime ?? "").trim();
    const endTime = String(body.endTime ?? "").trim();
    const published =
      body.published === undefined ? undefined : Boolean(body.published);

    if (!shiftDate || !staffEmail || !startTime || !endTime) {
      return jsonError(
        "shiftDate, staffEmail, startTime, endTime required.",
        400,
      );
    }
    if (endTime <= startTime) {
      return jsonError("endTime must be after startTime.", 400);
    }

    const db = getDb();
    const staff = await listActiveStaff(db);
    const member = staff.find((s) => s.email === staffEmail);
    if (!member) return jsonError("Staff member not found.", 404);

    const staffName = staffDisplayName(member, staffEmail);
    const shift = await updateRosterShift(db, id, {
      shiftDate,
      staffEmail,
      staffName,
      startTime,
      endTime,
      published,
    });
    if (!shift) return jsonError("Shift not found.", 404);

    return jsonOk({ shift });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, 403);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireEffectiveUser();
    if (!isOwner(user)) return jsonError("Owner access required.", 403);
    const { id } = await params;
    const db = getDb();
    await deleteRosterShift(db, id);
    return jsonOk({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, 403);
  }
}
