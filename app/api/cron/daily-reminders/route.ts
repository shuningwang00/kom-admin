import { jsonError, jsonOk } from "@/lib/api/json";
import { sendDailyReminder } from "@/lib/cron/daily-reminders";

export const dynamic = "force-dynamic";

/**
 * Called daily by Vercel Cron at 02:00 UTC (10:00 SGT).
 * Vercel automatically sends: Authorization: Bearer {CRON_SECRET}
 */
export async function GET(_request: Request) {

  try {
    await sendDailyReminder();
    return jsonOk({ sent: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/daily-reminders]", message);
    return jsonError(message, 500);
  }
}
