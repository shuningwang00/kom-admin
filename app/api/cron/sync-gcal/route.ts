import { jsonError, jsonOk } from "@/lib/api/json";
import { syncToGoogleCalendar } from "@/lib/google/calendar-sync";

export const dynamic = "force-dynamic";

/** Vercel Cron daily at 12:00 UTC (20:00 SGT). */
export async function GET(request: Request) {
  try {
    const auth = request.headers.get("authorization");
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return jsonError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("preview") === "1";

    const result = await syncToGoogleCalendar(dryRun);
    return jsonOk(result);
  } catch (err) {
    console.error("[cron/sync-gcal]", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return jsonError(message, 500);
  }
}
