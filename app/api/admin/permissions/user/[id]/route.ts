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
    const body = (await request.json()) as Record<string, boolean>;

    const db = getDb();
    const [existing] = await db
      .select({ id: siteAllowlist.id })
      .from(siteAllowlist)
      .where(eq(siteAllowlist.id, id))
      .limit(1);

    if (!existing) return jsonError("Member not found", 404);

    await db
      .update(siteAllowlist)
      .set({ permissionsJson: JSON.stringify(body) })
      .where(eq(siteAllowlist.id, id));

    return jsonOk({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message.includes("Owner") ? 403 : 401);
  }
}
