import { jsonError, jsonOk } from "@/lib/api/json";
import { requireOwner } from "@/lib/auth/access";
import { updateStaffHourlyRate } from "@/lib/people/clock";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    await requireOwner();
    const body = (await request.json()) as { email?: string; hourlyRate?: string };
    if (!body.email) return jsonError("email required.");
    await updateStaffHourlyRate(body.email, body.hourlyRate ?? "");
    return jsonOk({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message.includes("Owner") ? 403 : 500;
    return jsonError(message, status);
  }
}
