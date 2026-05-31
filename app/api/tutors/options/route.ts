import { jsonError, jsonOk } from "@/lib/api/json";
import { requireEffectiveUser } from "@/lib/auth/access";
import { listTutorOptions } from "@/lib/tutors/options";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireEffectiveUser();
    const tutors = await listTutorOptions();
    return jsonOk({ tutors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}
