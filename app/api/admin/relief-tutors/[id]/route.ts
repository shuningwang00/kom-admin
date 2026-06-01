import { jsonError, jsonOk } from "@/lib/api/json";
import { requireOwner } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { deleteReliefOnlyTutor } from "@/lib/tutors/relief-only-tutors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id } = await params;
    const db = getDb();
    await deleteReliefOnlyTutor(db, id);
    return jsonOk({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, 403);
  }
}
