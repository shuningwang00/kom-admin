import { assertCanReadRoster } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { listTrialsByStatus } from "@/lib/trials/list";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await assertCanReadRoster();
    const rows = await listTrialsByStatus("active");
    return jsonOk({ activeCount: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message.includes("Sign in") || message === "Unauthorized" ? 401 : 403;
    return jsonError(message, status);
  }
}
