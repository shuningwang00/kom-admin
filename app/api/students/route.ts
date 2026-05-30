import {
  assertCanManageStudents,
  assertCanReadRoster,
} from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { students } from "@/lib/db/schema";
import { asc, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await assertCanReadRoster();
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("archived") === "1";
    const db = getDb();
    const rows = await db
      .select()
      .from(students)
      .where(includeArchived ? undefined : isNull(students.archivedAt))
      .orderBy(asc(students.name));
    return jsonOk({ students: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}

export async function POST(request: Request) {
  try {
    await assertCanManageStudents();
    const body = (await request.json()) as {
      name?: string;
      contact?: string;
      school?: string;
      parentName?: string;
      startDate?: string | null;
      notes?: string;
      freeTrial?: boolean;
      registrationFeeDue?: boolean;
      classId?: string;
    };

    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Name is required.");

    const db = getDb();
    const [created] = await db
      .insert(students)
      .values({
        name,
        contact: String(body.contact ?? "").trim(),
        school: String(body.school ?? "").trim(),
        parentName: String(body.parentName ?? "").trim(),
        startDate: body.startDate?.trim() || null,
        notes: String(body.notes ?? "").trim(),
      })
      .returning();

    if (body.classId?.trim()) {
      const { enrollments } = await import("@/lib/db/schema");
      await db.insert(enrollments).values({
        studentId: created.id,
        classId: body.classId.trim(),
        freeTrial: Boolean(body.freeTrial),
        registrationFeeDue: Boolean(body.registrationFeeDue),
        startedAt: body.startDate?.trim() || null,
      });
    }

    return jsonOk({ student: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("cannot edit")
          ? 403
          : 500;
    return jsonError(message, status);
  }
}
