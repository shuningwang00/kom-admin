import { requireOwner } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { attendanceRecords, classSessions } from "@/lib/db/schema";
import { eq, inArray, notInArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireOwner();
    const db = getDb();

    // Find all custom makeup session IDs
    const customSessions = await db
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(eq(classSessions.rescheduleNote, "Makeup session"));

    if (customSessions.length === 0) {
      return jsonOk({ deleted: 0, message: "No custom makeup sessions found." });
    }

    const customSessionIds = customSessions.map((s) => s.id);

    // Of those, find which ones still have attendance records
    const occupied = await db
      .selectDistinct({ sessionId: attendanceRecords.sessionId })
      .from(attendanceRecords)
      .where(inArray(attendanceRecords.sessionId, customSessionIds));

    const occupiedIds = new Set(occupied.map((r) => r.sessionId));
    const orphanIds = customSessionIds.filter((id) => !occupiedIds.has(id));

    if (orphanIds.length === 0) {
      return jsonOk({ deleted: 0, message: "No orphaned custom makeup sessions found." });
    }

    await db.delete(classSessions).where(inArray(classSessions.id, orphanIds));

    return jsonOk({ deleted: orphanIds.length, orphanIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}
