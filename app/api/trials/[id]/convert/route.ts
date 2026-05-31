import { assertCanManageStudents } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { trialLeads } from "@/lib/db/schema";
import { convertTrialLead } from "@/lib/trials/convert";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanManageStudents();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const db = getDb();

    const [trial] = await db
      .select()
      .from(trialLeads)
      .where(eq(trialLeads.id, id))
      .limit(1);

    if (!trial) return jsonError("Trial not found.", 404);

    const result = await convertTrialLead(db, trial, {
      startDate:
        body.startDate != null ? String(body.startDate) : undefined,
      registrationFeeDue: Boolean(body.registrationFeeDue),
      classId:
        body.classId != null ? String(body.classId) : undefined,
    });

    return jsonOk(result, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("cannot edit")
          ? 403
          : message.includes("required") || message.includes("already")
            ? 400
            : message.includes("DATABASE_URL")
              ? 503
              : 500;
    return jsonError(message, status);
  }
}
