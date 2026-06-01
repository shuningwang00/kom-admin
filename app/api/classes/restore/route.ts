import { assertCanMutateClasses } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { restoreClassesFromBackup } from "@/lib/classes-sheet/sync";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await assertCanMutateClasses();
    const db = getDb();
    const result = await restoreClassesFromBackup(db);
    if (result.error) return jsonError(result.error, 400);
    return jsonOk({ restored: result.restored });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message.includes("Only") ? 403 : 500);
  }
}
