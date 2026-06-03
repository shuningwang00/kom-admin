import { assertCanManageStudents } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { trialLeads } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Mark trial lead as declined — they did not become a full-time student. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCanManageStudents();
    const { id } = await params;
    const db = getDb();

    const updated = await db
      .update(trialLeads)
      .set({ status: "declined" })
      .where(and(eq(trialLeads.id, id), eq(trialLeads.status, "active")))
      .returning({ id: trialLeads.id });

    if (updated.length === 0) {
      return jsonError("Trial not found or already converted.", 404);
    }

    return jsonOk({ declined: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}
