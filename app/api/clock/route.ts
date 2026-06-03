import { jsonError, jsonOk } from "@/lib/api/json";
import { isOwner, requireEffectiveUser } from "@/lib/auth/access";
import {
  createClockEntry,
  getStaffMember,
  getTodayRosterShift,
  listClockEntriesForMonth,
  listClockableStaff,
} from "@/lib/people/clock";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireEffectiveUser();
    const params = new URL(request.url).searchParams;
    const month = params.get("month")?.trim();
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return jsonError("Query ?month=YYYY-MM required.");
    }
    const ownerView = isOwner(user);
    const filterEmail = ownerView ? undefined : user.email;
    // Use SGT (UTC+8) so the date matches what was stored from the browser
    const now = new Date();
    const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const today = sgt.toISOString().slice(0, 10);
    const [entries, staff, todayShift, selfStaff] = await Promise.all([
      listClockEntriesForMonth(month, filterEmail),
      ownerView ? listClockableStaff() : Promise.resolve([]),
      getTodayRosterShift(user.email, today),
      ownerView ? Promise.resolve(null) : getStaffMember(user.email),
    ]);
    return jsonOk({ entries, staff, isOwner: ownerView, todayShift, today, shiftSearchEmail: user.email, selfStaff });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireEffectiveUser();
    const body = (await request.json()) as {
      staffEmail?: string;
      staffName?: string;
      entryDate?: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
    };

    const { staffEmail, staffName, entryDate, startTime, endTime, notes = "" } = body;
    if (!entryDate || !startTime || !endTime) {
      return jsonError("entryDate, startTime, endTime are required.");
    }

    // Staff can only create entries for themselves
    const targetEmail = isOwner(user) ? (staffEmail ?? user.email) : user.email;
    const targetName = isOwner(user) ? (staffName ?? user.displayName ?? "") : (user.displayName ?? "");

    const entry = await createClockEntry({
      staffEmail: targetEmail,
      staffName: targetName,
      entryDate,
      startTime,
      endTime,
      notes,
      createdBy: user.email,
    });
    return jsonOk({ entry }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}
