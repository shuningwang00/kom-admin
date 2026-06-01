import { jsonError, jsonOk } from "@/lib/api/json";
import {
  hasStaffPrivileges,
  isOwner,
  isTutor,
  requireEffectiveUser,
} from "@/lib/auth/access";
import { suggestedAvailabilityMonth } from "@/lib/centre-hours";
import { getDb } from "@/lib/db/index";
import { dbErrorMessage } from "@/lib/db/query-error";
import {
  listAvailabilityForMonth,
  replaceStaffMonthAvailability,
} from "@/lib/people/staff-availability";
import { listActiveStaff, staffOptionForApi } from "@/lib/people/staff-list";
import {
  datesBlockedByTimeOff,
  listStaffTimeOffForMonth,
} from "@/lib/people/staff-time-off";

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
    const staff = isOwner(user) ? await listActiveStaff(db) : [];

    let staffEmail = user.email.trim().toLowerCase();
    if (isOwner(user)) {
      if (!staffEmailParam) {
        return jsonOk({
          month,
          suggestedMonth: suggestedAvailabilityMonth(),
          slots: [],
          staff,
          staffEmail: null,
          actingAsOwner: true,
        });
      }
      const allowed = staff.some((s) => s.email === staffEmailParam);
      if (!allowed) return jsonError("Staff member not found.", 404);
      staffEmail = staffEmailParam;
    }

    const [slots, timeOffRecords] = await Promise.all([
      listAvailabilityForMonth(db, month, staffEmail),
      listStaffTimeOffForMonth(db, staffEmail, month),
    ]);
    const timeOffDates = [...datesBlockedByTimeOff(timeOffRecords, month)];

    return jsonOk({
      month,
      suggestedMonth: suggestedAvailabilityMonth(),
      slots,
      timeOffRecords,
      timeOffDates,
      staff: isOwner(user) ? staff.map(staffOptionForApi) : undefined,
      staffEmail,
      actingAsOwner: isOwner(user),
    });
  } catch (err) {
    return jsonError(dbErrorMessage(err), availabilityErrorStatus(err));
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

    let targetEmail = user.email.trim().toLowerCase();
    const db = getDb();
    if (isOwner(user)) {
      const picked = body.staffEmail?.trim().toLowerCase();
      if (!picked) return jsonError("Select a staff member.", 400);
      const staff = await listActiveStaff(db);
      if (!staff.some((s) => s.email === picked)) {
        return jsonError("Staff member not found.", 404);
      }
      targetEmail = picked;
    }

    let slots = Array.isArray(body.slots) ? body.slots : [];
    for (const s of slots) {
      if (!s.availDate || !s.startTime || !s.endTime) {
        return jsonError("Each slot needs availDate, startTime, endTime.", 400);
      }
      if (s.endTime <= s.startTime) {
        return jsonError("endTime must be after startTime.", 400);
      }
    }

    const timeOffRecords = await listStaffTimeOffForMonth(db, targetEmail, month);
    const blocked = datesBlockedByTimeOff(timeOffRecords, month);
    slots = slots.filter((s) => !blocked.has(s.availDate));

    await replaceStaffMonthAvailability(db, targetEmail, month, slots, {
      preserveAvailDates: blocked,
    });

    const saved = await listAvailabilityForMonth(db, month, targetEmail);
    return jsonOk({ month, staffEmail: targetEmail, slots: saved });
  } catch (err) {
    return jsonError(dbErrorMessage(err), availabilityErrorStatus(err));
  }
}

function availabilityErrorStatus(err: unknown): number {
  const msg = err instanceof Error ? err.message : "";
  if (msg === "Unauthorized") return 401;
  if (/required|sign in|staff access/i.test(msg)) return 403;
  return 500;
}
