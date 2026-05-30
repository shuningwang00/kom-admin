import {
  assertCanManageStudents,
  assertCanReadRoster,
} from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { classes, enrollments, students } from "@/lib/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await assertCanReadRoster();
    const db = getDb();
    const rows = await db
      .select({
        enrollment: enrollments,
        student: students,
        class: classes,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .innerJoin(classes, eq(enrollments.classId, classes.id))
      .where(isNull(enrollments.endedAt))
      .orderBy(asc(students.name), asc(classes.label));
    return jsonOk({ enrollments: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    await assertCanManageStudents();
    const body = (await request.json()) as {
      studentId?: string;
      classId?: string;
      startedAt?: string | null;
      freeTrial?: boolean;
      registrationFeeDue?: boolean;
      notes?: string;
    };
    if (!body.studentId?.trim() || !body.classId?.trim()) {
      return jsonError("studentId and classId are required.");
    }

    const db = getDb();
    const [existing] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, body.studentId.trim()),
          eq(enrollments.classId, body.classId.trim()),
          isNull(enrollments.endedAt),
        ),
      )
      .limit(1);
    if (existing) {
      return jsonError("Student is already enrolled in this class.");
    }

    const [created] = await db
      .insert(enrollments)
      .values({
        studentId: body.studentId.trim(),
        classId: body.classId.trim(),
        startedAt: body.startedAt?.trim() || null,
        freeTrial: Boolean(body.freeTrial),
        registrationFeeDue: Boolean(body.registrationFeeDue),
        notes: String(body.notes ?? "").trim(),
      })
      .returning();
    return jsonOk({ enrollment: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized" ? 401 : message.includes("cannot") ? 403 : 500;
    return jsonError(message, status);
  }
}
