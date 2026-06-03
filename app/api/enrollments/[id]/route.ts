import { assertCanManageStudents } from "@/lib/auth/access";
import { invalidateEnrollmentCache } from "@/lib/attendance/list-sessions";
import { jsonError, jsonOk } from "@/lib/api/json";
import { validatePauseDates } from "@/lib/enrollments/pause";
import { getDb } from "@/lib/db/index";
import { attendanceRecords, classSessions, enrollments } from "@/lib/db/schema";
import { and, eq, gte, inArray, lt } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** PATCH: update enrollment, withdraw (`end`), or reinstate. */

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await assertCanManageStudents();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const db = getDb();
    const patch: Partial<typeof enrollments.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.freeTrial != null) patch.freeTrial = Boolean(body.freeTrial);
    if (body.registrationFeeDue != null) {
      patch.registrationFeeDue = Boolean(body.registrationFeeDue);
    }
    if (body.notes != null) patch.notes = String(body.notes).trim();
    if (body.startedAt !== undefined) {
      patch.startedAt =
        body.startedAt == null || body.startedAt === ""
          ? null
          : String(body.startedAt);
    }
    if (body.trialAttendedAt !== undefined) {
      patch.trialAttendedAt =
        body.trialAttendedAt == null || body.trialAttendedAt === ""
          ? null
          : String(body.trialAttendedAt);
    }
    if (body.reinstate === true) {
      patch.endedAt = null;
    } else if (body.end === true) {
      patch.endedAt =
        body.endedAt != null && body.endedAt !== ""
          ? String(body.endedAt)
          : new Date().toISOString().slice(0, 10);
      patch.pauseStartedAt = null;
      patch.pauseEndedAt = null;
    } else if (body.unpause === true) {
      patch.pauseStartedAt = null;
      patch.pauseEndedAt = null;
    } else if (body.pause === true) {
      const pauseStartedAt = String(body.pauseStartedAt ?? "").trim();
      const pauseEndedAt =
        body.pauseEndedAt == null || body.pauseEndedAt === ""
          ? null
          : String(body.pauseEndedAt).trim();
      const pauseError = validatePauseDates(pauseStartedAt, pauseEndedAt);
      if (pauseError) return jsonError(pauseError, 400);
      patch.pauseStartedAt = pauseStartedAt;
      patch.pauseEndedAt = pauseEndedAt;
    }

    const [updated] = await db
      .update(enrollments)
      .set(patch)
      .where(eq(enrollments.id, id))
      .returning();
    if (!updated) return jsonError("Enrollment not found.", 404);

    let deletedAttendanceCount = 0;
    if (body.end === true || body.pause === true) {
      const dateFrom =
        body.end === true
          ? (updated.endedAt as string)
          : (updated.pauseStartedAt as string);
      const dateTo = body.pause === true ? updated.pauseEndedAt : null;

      const sessionConditions = [
        eq(classSessions.classId, updated.classId),
        gte(classSessions.scheduledDate, dateFrom),
      ];
      if (dateTo) sessionConditions.push(lt(classSessions.scheduledDate, dateTo));

      const affectedSessions = await db
        .select({ id: classSessions.id })
        .from(classSessions)
        .where(and(...sessionConditions));

      if (affectedSessions.length > 0) {
        const deleted = await db
          .delete(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.studentId, updated.studentId),
              inArray(
                attendanceRecords.sessionId,
                affectedSessions.map((s) => s.id),
              ),
            ),
          )
          .returning({ id: attendanceRecords.id });
        deletedAttendanceCount = deleted.length;
      }
    }

    invalidateEnrollmentCache();
    return jsonOk({ enrollment: updated, deletedAttendanceCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized" ? 401 : message.includes("cannot") ? 403 : 500;
    return jsonError(message, status);
  }
}
