import { assertCanManageStudents, assertCanReadRoster } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { holidayProgrammeAttendance } from "@/lib/db/schema";
import { listSessionAttendance } from "@/lib/programmes/list";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  try {
    await assertCanReadRoster();
    const { sessionId } = await params;
    const attendance = await listSessionAttendance(sessionId);
    return jsonOk({ attendance });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  try {
    const user = await assertCanManageStudents();
    const { sessionId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const updates = body.updates as Array<{
      participantId: string;
      status: string;
    }> | undefined;

    if (!Array.isArray(updates) || updates.length === 0) {
      return jsonError("updates array is required.");
    }

    const db = getDb();
    const actor = user.email ?? "";

    for (const u of updates) {
      const participantId = String(u.participantId ?? "").trim();
      const status = String(u.status ?? "").trim();
      if (!participantId || !status) continue;

      await db
        .insert(holidayProgrammeAttendance)
        .values({
          sessionId,
          participantId,
          status: status as typeof holidayProgrammeAttendance.$inferInsert["status"],
          updatedBy: actor,
        })
        .onConflictDoUpdate({
          target: [
            holidayProgrammeAttendance.sessionId,
            holidayProgrammeAttendance.participantId,
          ],
          set: {
            status: status as typeof holidayProgrammeAttendance.$inferInsert["status"],
            updatedBy: actor,
            updatedAt: new Date(),
          },
        });
    }

    const attendance = await listSessionAttendance(sessionId);
    return jsonOk({ attendance });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}
