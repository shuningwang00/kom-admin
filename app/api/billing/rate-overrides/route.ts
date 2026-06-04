import { assertCanUseBilling } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db";
import { classes, studentRateOverrides, students } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await assertCanUseBilling();
    const db = getDb();

    const rows = await db
      .select({
        id: studentRateOverrides.id,
        studentId: studentRateOverrides.studentId,
        studentName: students.name,
        classId: studentRateOverrides.classId,
        classLabel: classes.label,
        ratePerLesson: studentRateOverrides.ratePerLesson,
        validFrom: studentRateOverrides.validFrom,
        validTo: studentRateOverrides.validTo,
        notes: studentRateOverrides.notes,
        createdBy: studentRateOverrides.createdBy,
        createdAt: studentRateOverrides.createdAt,
      })
      .from(studentRateOverrides)
      .innerJoin(students, eq(studentRateOverrides.studentId, students.id))
      .leftJoin(classes, eq(studentRateOverrides.classId, classes.id))
      .orderBy(asc(students.name), asc(studentRateOverrides.createdAt));

    return jsonOk({ overrides: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return jsonError(msg, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await assertCanUseBilling();
    const db = getDb();
    const body = (await request.json()) as {
      studentId: string;
      classId?: string | null;
      ratePerLesson: string;
      validFrom?: string | null;
      validTo?: string | null;
      notes?: string;
    };

    if (!body.studentId || !body.ratePerLesson) {
      return jsonError("studentId and ratePerLesson are required.", 400);
    }
    const rate = parseFloat(body.ratePerLesson);
    if (isNaN(rate) || rate < 0) return jsonError("Invalid rate.", 400);

    const [row] = await db
      .insert(studentRateOverrides)
      .values({
        studentId: body.studentId,
        classId: body.classId ?? null,
        ratePerLesson: rate.toFixed(2),
        validFrom: body.validFrom ?? null,
        validTo: body.validTo ?? null,
        notes: body.notes ?? "",
        createdBy: user.email,
      })
      .returning();

    return jsonOk({ override: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return jsonError(msg, 500);
  }
}
