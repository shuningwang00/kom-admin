import { generateSessionsForMonth } from "@/lib/scheduling/generate-sessions";
import { jsonError, jsonOk } from "@/lib/api/json";
import { requireOwner } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireOwner();
    const body = (await request.json().catch(() => ({}))) as {
      yearMonth?: string;
    };
    const yearMonth =
      body.yearMonth?.trim() || new Date().toISOString().slice(0, 7);
    const result = await generateSessionsForMonth(yearMonth);
    return jsonOk({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("Admin")
          ? 403
          : 500;
    return jsonError(message, status);
  }
}
