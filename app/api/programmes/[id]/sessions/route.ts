import { assertCanManageStudents } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { holidayProgrammeSessions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanManageStudents();
    const { id: programmeId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const scheduledDate = String(body.scheduledDate ?? "").trim();
    if (!scheduledDate) return jsonError("Session date is required.");

    const db = getDb();
    const [created] = await db
      .insert(holidayProgrammeSessions)
      .values({
        programmeId,
        scheduledDate,
        timeLabel: String(body.timeLabel ?? "").trim(),
        tutorName: String(body.tutorName ?? "").trim(),
        notes: String(body.notes ?? "").trim(),
      })
      .returning();

    return jsonOk({ session: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("unique")
          ? 409
          : 500;
    return jsonError(message, status);
  }
}
