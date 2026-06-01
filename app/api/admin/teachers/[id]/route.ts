import { requireOwner } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { siteAllowlist } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const db = getDb();
    const patch: Partial<typeof siteAllowlist.$inferInsert> = {};
    if (body.displayName != null) {
      patch.displayName = String(body.displayName).trim();
    }
    if (body.fullName != null) {
      patch.fullName = String(body.fullName).trim();
    }
    if (body.tutorMatch != null) {
      patch.tutorMatch = String(body.tutorMatch).trim();
    }
    if (body.isActive != null) patch.isActive = Boolean(body.isActive);
    if (body.role === "staff" || body.role === "tutor" || body.role === "staff_tutor") {
      patch.role = body.role as "staff" | "tutor" | "staff_tutor";
    }
    if (body.email != null) {
      const email = String(body.email).trim().toLowerCase();
      if (!email.includes("@")) return jsonError("Valid email required.");
      patch.email = email;
    }

    const [updated] = await db
      .update(siteAllowlist)
      .set(patch)
      .where(eq(siteAllowlist.id, id))
      .returning();
    if (!updated) return jsonError("Not found.", 404);
    return jsonOk({ member: updated, tutor: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, 403);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireOwner();
    const { id } = await params;
    const db = getDb();
    await db.delete(siteAllowlist).where(eq(siteAllowlist.id, id));
    return jsonOk({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, 403);
  }
}
