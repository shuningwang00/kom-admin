import { assertCanManageStudents, assertCanReadRoster } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { trialLeads } from "@/lib/db/schema";
import { listTrialsByStatus } from "@/lib/trials/list";
import { contactFieldsForCreate } from "@/lib/students/contact-fields";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await assertCanReadRoster();
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") ?? "active") as
      | "active"
      | "converted";
    const rows = await listTrialsByStatus(status);
    return jsonOk({ trials: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}

export async function POST(request: Request) {
  try {
    await assertCanManageStudents();
    const body = (await request.json()) as Record<string, unknown>;

    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Name is required.");

    const classId = String(body.classId ?? "").trim();
    if (!classId) return jsonError("Class is required for a free trial.");

    const db = getDb();
    const [created] = await db
      .insert(trialLeads)
      .values({
        name,
        ...contactFieldsForCreate(body),
        school: String(body.school ?? "").trim(),
        parentName: String(body.parentName ?? "").trim(),
        classId,
        trialDate:
          body.trialDate != null && String(body.trialDate).trim()
            ? String(body.trialDate).trim()
            : null,
        notes: String(body.notes ?? "").trim(),
        status: "active",
      })
      .returning();

    return jsonOk({ trial: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("cannot edit") || message.includes("Roster")
          ? 403
          : message.includes("DATABASE_URL")
            ? 503
            : 500;
    return jsonError(message, status);
  }
}
