import { assertCanManageStudents } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { holidayProgrammeParticipants, students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanManageStudents();
    const { id: programmeId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const db = getDb();
    const studentId = String(body.studentId ?? "").trim() || null;

    if (studentId) {
      const [existing] = await db
        .select()
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1);
      if (!existing) return jsonError("Student not found.", 404);

      const [created] = await db
        .insert(holidayProgrammeParticipants)
        .values({
          programmeId,
          studentId,
          name: existing.name,
          fee: String(body.fee ?? "").trim(),
          feePaid: Boolean(body.feePaid),
          status: "active",
        })
        .returning();

      return jsonOk({ participant: created }, 201);
    }

    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Name is required for new leads.");

    const { parseContactType } = await import("@/lib/contacts");

    const [created] = await db
      .insert(holidayProgrammeParticipants)
      .values({
        programmeId,
        name,
        primaryContact: String(body.primaryContact ?? "").trim(),
        primaryContactType: parseContactType(body.primaryContactType) ?? null,
        secondaryContact: String(body.secondaryContact ?? "").trim(),
        secondaryContactType:
          parseContactType(body.secondaryContactType) ?? null,
        level: String(body.level ?? "").trim(),
        school: String(body.school ?? "").trim(),
        parentName: String(body.parentName ?? "").trim(),
        notes: String(body.notes ?? "").trim(),
        fee: String(body.fee ?? "").trim(),
        feePaid: Boolean(body.feePaid),
        status: "active",
      })
      .returning();

    return jsonOk({ participant: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized" ? 401 : message.includes("DATABASE_URL") ? 503 : 500;
    return jsonError(message, status);
  }
}
