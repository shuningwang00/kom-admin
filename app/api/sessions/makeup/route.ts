import { scheduleMakeup } from "@/lib/attendance/makeup";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanScheduleMakeup } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { classes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      classId?: string;
      sourceSessionId?: string;
      studentId?: string;
      makeupDate?: string;
      note?: string;
      makeupClassId?: string;
      timeLabel?: string;
      reliefTutor?: string;
    };
    if (!body.classId || !body.studentId || !body.makeupDate?.trim()) {
      return jsonError("classId, studentId, and makeupDate are required.");
    }

    const db = getDb();
    const [cls] = await db
      .select()
      .from(classes)
      .where(eq(classes.id, body.classId))
      .limit(1);
    if (!cls) return jsonError("Class not found.", 404);

    const actor = await assertCanScheduleMakeup(cls.tutor);
    const result = await scheduleMakeup({
      actor,
      sourceClassId: body.classId,
      sourceSessionId: body.sourceSessionId?.trim() || undefined,
      studentId: body.studentId,
      makeupDate: body.makeupDate.trim(),
      note: body.note,
      makeupClassId: body.makeupClassId?.trim() || undefined,
      timeLabel: body.timeLabel?.trim() || undefined,
      reliefTutor: body.reliefTutor?.trim() || undefined,
    });
    return jsonOk(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.includes("Only admins") ? 403 : 500;
    return jsonError(message, status);
  }
}
