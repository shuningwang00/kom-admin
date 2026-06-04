import { assertCanScheduleMakeup } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { classSessions, classes } from "@/lib/db/schema";
import { canonicalSlotTimeLabel } from "@/lib/attendance/session-slot-matching";
import { and, eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");
    if (!classId || !date) return jsonError("classId and date are required.");

    const db = getDb();
    const [row] = await db
      .select({ session: classSessions, class: classes })
      .from(classSessions)
      .innerJoin(classes, eq(classSessions.classId, classes.id))
      .where(
        and(
          eq(classSessions.classId, classId),
          eq(classSessions.scheduledDate, date),
          inArray(classSessions.status, ["scheduled", "cancelled"]),
        ),
      )
      .limit(1);

    if (!row) return jsonOk({ session: null });

    await assertCanScheduleMakeup(row.class.tutor);

    return jsonOk({
      session: {
        sessionId: row.session.id,
        timeLabel: canonicalSlotTimeLabel({ session: row.session, class: row.class }),
        rescheduleNote: row.session.rescheduleNote ?? "",
        status: row.session.status,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}
