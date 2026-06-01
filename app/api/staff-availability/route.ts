import { jsonError, jsonOk } from "@/lib/api/json";
import {
  hasStaffPrivileges,
  isOwner,
  isTutor,
  requireEffectiveUser,
} from "@/lib/auth/access";
import { suggestedAvailabilityMonth } from "@/lib/centre-hours";
import { getDb } from "@/lib/db/index";
import {
  listAvailabilityForMonth,
  replaceStaffMonthAvailability,
} from "@/lib/people/staff-availability";
import { listActiveStaff } from "@/lib/people/staff-list";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireEffectiveUser();
    if (isTutor(user) && !hasStaffPrivileges(user)) {
      return jsonError("Staff access required.", 403);
    }

    const { searchParams } = new URL(request.url);
    const month =
      searchParams.get("month")?.trim() || suggestedAvailabilityMonth();
    const staffEmailParam = searchParams.get("staffEmail")?.trim().toLowerCase();

    const db = getDb();
    const staffEmail = isOwner(user)
      ? staffEmailParam || undefined
      : user.email.trim().toLowerCase();

    const [slots, staff] = await Promise.all([
      listAvailabilityForMonth(db, month, staffEmail),
      isOwner(user) ? listActiveStaff(db) : Promise.resolve([]),
    ]);

    return jsonOk({
      month,
      suggestedMonth: suggestedAvailabilityMonth(),
      slots,
      staff: isOwner(user) ? staff : undefined,
      staffEmail: staffEmail ?? user.email,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 403);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireEffectiveUser();
    if (!hasStaffPrivileges(user) && !isOwner(user)) {
      return jsonError("Staff access required.", 403);
    }

    const body = (await request.json()) as {
      month?: string;
      slots?: Array<{
        availDate: string;
        startTime: string;
        endTime: string;
        slotLabel?: string;
        note?: string;
      }>;
      staffEmail?: string;
    };

    const month = body.month?.trim() || suggestedAvailabilityMonth();
    const targetEmail = (
      isOwner(user) && body.staffEmail?.trim()
        ? body.staffEmail
        : user.email
    )
      .trim()
      .toLowerCase();

    const slots = Array.isArray(body.slots) ? body.slots : [];
    for (const s of slots) {
      if (!s.availDate || !s.startTime || !s.endTime) {
        return jsonError("Each slot needs availDate, startTime, endTime.", 400);
      }
      if (s.endTime <= s.startTime) {
        return jsonError("endTime must be after startTime.", 400);
      }
    }

    const db = getDb();
    await replaceStaffMonthAvailability(db, targetEmail, month, slots);

    const saved = await listAvailabilityForMonth(db, month, targetEmail);
    return jsonOk({ month, staffEmail: targetEmail, slots: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 403);
  }
}
