import { jsonError, jsonOk } from "@/lib/api/json";
import { requireOwner } from "@/lib/auth/access";
import { getRefreshTokenFromStore, saveRefreshTokenToDb } from "@/lib/google/auth";

export const dynamic = "force-dynamic";

/**
 * Owner-only: saves the current OAuth refresh token from cookie/env into the DB
 * so all staff share it for Drive uploads. Call this once after re-authorizing.
 */
export async function POST() {
  try {
    await requireOwner();
    const token = await getRefreshTokenFromStore();
    if (!token) {
      return jsonError("No Google token found. Go to the Billing page and click 'Connect Google' first.", 400);
    }
    await saveRefreshTokenToDb(token);
    return jsonOk({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return jsonError(msg, 500);
  }
}
