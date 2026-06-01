import { writeAuditLog } from "@/lib/attendance/audit";
import { loadSessionDetail } from "@/lib/attendance/session-detail";
import { assertSessionNotCancelled } from "@/lib/attendance/cancel-session";
import { sessionActiveExpectedTotal } from "@/lib/attendance/relief-tutor-session";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanMarkAttendance } from "@/lib/auth/access";
import { isReliefTutorNeeded } from "@/lib/tutors/constants";
import { getDb } from "@/lib/db/index";
import { classSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const detail = await loadSessionDetail(id);
    if (!detail) return jsonError("Session not found.", 404);

    const user = await assertCanMarkAttendance(detail.class.tutor);
    assertSessionNotCancelled(detail.session.status);
    const body = (await request.json()) as { reliefTutor?: string | null };
    const reliefTutor = String(body.reliefTutor ?? "").trim();

    if (
      isReliefTutorNeeded(reliefTutor) &&
      sessionActiveExpectedTotal(detail.expected) === 0
    ) {
      return jsonError(
        "No students expected for this session — relief tutor is not required.",
        400,
      );
    }

    const db = getDb();
    const before = { reliefTutor: detail.session.reliefTutor ?? "" };

    const [updated] = await db
      .update(classSessions)
      .set({ reliefTutor, updatedAt: new Date() })
      .where(eq(classSessions.id, id))
      .returning();

    await writeAuditLog({
      actor: user,
      action: "set_relief_tutor",
      entityType: "class_session",
      entityId: id,
      before,
      after: { reliefTutor },
    });

    return jsonOk({ session: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message.includes("access") ? 403 : 500);
  }
}
