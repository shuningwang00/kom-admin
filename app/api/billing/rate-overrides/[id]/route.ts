import { assertCanUseBilling } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db";
import { studentRateOverrides } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanUseBilling();
    const { id } = await params;
    const db = getDb();
    const body = (await request.json()) as {
      ratePerLesson?: string;
      classId?: string | null;
      validFrom?: string | null;
      validTo?: string | null;
      notes?: string;
    };

    const updates: Partial<typeof studentRateOverrides.$inferInsert> = {};
    if (body.ratePerLesson !== undefined) {
      const rate = parseFloat(body.ratePerLesson);
      if (isNaN(rate) || rate < 0) return jsonError("Invalid rate.", 400);
      updates.ratePerLesson = rate.toFixed(2);
    }
    if ("classId" in body) updates.classId = body.classId ?? null;
    if ("validFrom" in body) updates.validFrom = body.validFrom ?? null;
    if ("validTo" in body) updates.validTo = body.validTo ?? null;
    if (body.notes !== undefined) updates.notes = body.notes;

    const [row] = await db
      .update(studentRateOverrides)
      .set(updates)
      .where(eq(studentRateOverrides.id, id))
      .returning();

    if (!row) return jsonError("Override not found.", 404);
    return jsonOk({ override: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return jsonError(msg, 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanUseBilling();
    const { id } = await params;
    await getDb().delete(studentRateOverrides).where(eq(studentRateOverrides.id, id));
    return jsonOk({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return jsonError(msg, 500);
  }
}
