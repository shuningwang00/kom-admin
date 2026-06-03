import { jsonError, jsonOk } from "@/lib/api/json";
import { isOwner, requireEffectiveUser } from "@/lib/auth/access";
import { deleteClockEntry, getClockEntry, updateClockEntry } from "@/lib/people/clock";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireEffectiveUser();
    const { id } = await params;
    const existing = await getClockEntry(id);
    if (!existing) return jsonError("Entry not found.", 404);
    // Staff can only edit their own entries
    if (!isOwner(user) && existing.staffEmail !== user.email) {
      return jsonError("Unauthorized", 403);
    }
    const body = (await request.json()) as {
      entryDate?: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
    };
    const updated = await updateClockEntry(id, body);
    return jsonOk({ entry: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireEffectiveUser();
    const { id } = await params;
    const existing = await getClockEntry(id);
    if (!existing) return jsonError("Entry not found.", 404);
    if (!isOwner(user) && existing.staffEmail !== user.email) {
      return jsonError("Unauthorized", 403);
    }
    await deleteClockEntry(id);
    return jsonOk({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}
