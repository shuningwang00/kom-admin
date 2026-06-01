import { jsonError, jsonOk } from "@/lib/api/json";
import {
  hasStaffPrivileges,
  isOwner,
  isTutor,
  requireEffectiveUser,
} from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { dbErrorMessage } from "@/lib/db/query-error";
import {
  listStaffTimeOffTargets,
  timeOffPersonForApi,
} from "@/lib/people/staff-list";
import {
  createTimeOffEntries,
  listAllTimeOffEntries,
  listTimeOffEntries,
  resolveTimeOffPerson,
} from "@/lib/people/time-off-entries";

export const dynamic = "force-dynamic";

function canUseTimeOff(user: Awaited<ReturnType<typeof requireEffectiveUser>>): boolean {
  if (isOwner(user)) return true;
  if (hasStaffPrivileges(user)) return true;
  if (isTutor(user)) return true;
  return false;
}

export async function GET(request: Request) {
  try {
    const user = await requireEffectiveUser();
    if (!canUseTimeOff(user)) {
      return jsonError("Time off is not available for your account.", 403);
    }

    const db = getDb();

    if (isOwner(user)) {
      const people = await listStaffTimeOffTargets(db);
      const entries = await listAllTimeOffEntries(db, people);
      return jsonOk({
        entries,
        people: people.map(timeOffPersonForApi),
        actingAsOwner: true,
      });
    }

    const email = user.email.trim().toLowerCase();
    const allPeople = await listStaffTimeOffTargets(db);
    const person =
      allPeople.find((p) => p.email === email) ??
      (await resolveTimeOffPerson(db, email, allPeople));
    if (!person) return jsonError("Account not found.", 404);
    const entries = await listTimeOffEntries(db, person);
    return jsonOk({
      entries,
      personEmail: email,
      actingAsOwner: false,
    });
  } catch (err) {
    return jsonError(dbErrorMessage(err), apiErrorStatus(err));
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireEffectiveUser();
    if (!canUseTimeOff(user)) {
      return jsonError("Time off is not available for your account.", 403);
    }

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
    const people = await listStaffTimeOffTargets(db);
    let targetEmail = user.email.trim().toLowerCase();

    if (isOwner(user)) {
      const picked = String(body.personEmail ?? "").trim().toLowerCase();
      if (!picked) return jsonError("Select a team member.", 400);
      if (!people.some((p) => p.email === picked)) {
        return jsonError("Team member not found.", 404);
      }
      targetEmail = picked;
    } else if (isTutor(user) && !hasStaffPrivileges(user)) {
      targetEmail = user.email.trim().toLowerCase();
    }

    const person = await resolveTimeOffPerson(db, targetEmail, people);
    if (!person) return jsonError("Team member not found.", 404);

    const entry = await createTimeOffEntries(db, person, {
      startDate,
      endDate,
      reason,
      createdBy: user.email,
    });

    return jsonOk({ entry }, 201);
  } catch (err) {
    return jsonError(dbErrorMessage(err), apiErrorStatus(err));
  }
}

function apiErrorStatus(err: unknown): number {
  const msg = err instanceof Error ? err.message : "";
  if (/required|sign in|forbidden|not available/i.test(msg)) return 403;
  return 500;
}
