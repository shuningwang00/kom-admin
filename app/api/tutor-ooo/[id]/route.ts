import { jsonError, jsonOk } from "@/lib/api/json";
import { isTutor, requireEffectiveUser } from "@/lib/auth/access";
import { getTutorMatch } from "@/lib/auth/user";
import { deleteTutorOoo } from "@/lib/tutor-ooo/ooo";
import { getDb } from "@/lib/db/index";
import { tutorOoo } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireEffectiveUser();
    if (!user) return jsonError("Unauthorized", 401);

    const { id } = await params;

    // Tutors can only delete their own OOO records
    if (isTutor(user)) {
      const match = await getTutorMatch(user.email);
      const db = getDb();
      const [record] = await db
        .select({ tutorMatch: tutorOoo.tutorMatch })
        .from(tutorOoo)
        .where(eq(tutorOoo.id, id))
        .limit(1);
      if (!record) return jsonError("Not found.", 404);
      if (!match || match.toUpperCase() !== record.tutorMatch.toUpperCase()) {
        return jsonError("You can only delete your own OOO records.", 403);
      }
    }

    const deleted = await deleteTutorOoo(id);
    if (!deleted) return jsonError("Not found.", 404);
    return jsonOk({ deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}
