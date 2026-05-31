import { loadMakeupHub } from "@/lib/attendance/makeup-hub";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanAccessMakeupHub } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await assertCanAccessMakeupHub();
    const data = await loadMakeupHub();
    return jsonOk(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.includes("Makeup hub")
      ? 403
      : message.includes("Sign in") || message === "Unauthorized"
        ? 401
        : 500;
    return jsonError(message, status);
  }
}
