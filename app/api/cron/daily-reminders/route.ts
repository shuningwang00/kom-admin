import { jsonError, jsonOk } from "@/lib/api/json";
import { sendDailyReminder } from "@/lib/cron/daily-reminders";

export const dynamic = "force-dynamic";

/**
 * Called daily by Vercel Cron at 02:00 UTC (10:00 SGT).
 * Vercel automatically sends: Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return jsonError("Unauthorized", 401);
  }

  const preview = new URL(request.url).searchParams.get("preview") === "1";

  try {
    if (preview) {
      const { buildDailyReminder } = await import("@/lib/cron/daily-reminders");
      const message = await buildDailyReminder();
      return jsonOk({ message });
    }
    await sendDailyReminder();
    return jsonOk({ sent: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/daily-reminders]", message);
    return jsonError(message, 500);
  }
}
