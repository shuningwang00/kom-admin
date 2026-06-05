import { jsonError, jsonOk } from "@/lib/api/json";
import {
  isOwner,
  requireEffectiveUser,
} from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { dbErrorMessage } from "@/lib/db/query-error";
import { listStaffTimeOffTargets } from "@/lib/people/staff-list";
import {
  deleteTimeOffEntries,
  parseTimeOffEntryId,
  timeOffEntryPersonEmail,
  updateTimeOffEntries,
} from "@/lib/people/time-off-entries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function parseCompositeIds(rawId: string): string[] | null {
  const compositeIds = decodeURIComponent(rawId).split(",");
  for (const compositeId of compositeIds) {
    if (!parseTimeOffEntryId(compositeId)) return null;
  }
  return compositeIds;
}

async function assertCanManage(
  user: Awaited<ReturnType<typeof requireEffectiveUser>>,
  compositeIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (isOwner(user)) return { ok: true };

  const db = getDb();
  const people = await listStaffTimeOffTargets(db);
  const ownerEmail = await timeOffEntryPersonEmail(db, compositeIds, people);
  if (!ownerEmail) return { ok: false, message: "Not found." };

  const myEmail = user.email.trim().toLowerCase();
  if (ownerEmail !== myEmail) {
    return { ok: false, message: "You can only change your own time off." };
  }

  return { ok: true };
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireEffectiveUser();
    const { id: rawId } = await params;
    const compositeIds = parseCompositeIds(rawId);
    if (!compositeIds) return jsonError("Invalid time off id.", 400);

    const auth = await assertCanManage(user, compositeIds);
    if (!auth.ok) {
      return jsonError(auth.message, auth.message === "Not found." ? 404 : 403);
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
    const entry = await updateTimeOffEntries(db, compositeIds, {
      startDate,
      endDate,
      reason,
    });
    if (!entry) return jsonError("Not found.", 404);

    return jsonOk({ entry });
  } catch (err) {
    return jsonError(dbErrorMessage(err), 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireEffectiveUser();
    const { id: rawId } = await params;
    const compositeIds = parseCompositeIds(rawId);
    if (!compositeIds) return jsonError("Invalid time off id.", 400);

    const auth = await assertCanManage(user, compositeIds);
    if (!auth.ok) {
      return jsonError(auth.message, auth.message === "Not found." ? 404 : 403);
    }

    const db = getDb();
    await deleteTimeOffEntries(db, compositeIds);
    return jsonOk({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const status = /only change|forbidden|Not found/i.test(msg) ? 403 : 500;
    return jsonError(dbErrorMessage(err), status);
  }
}
