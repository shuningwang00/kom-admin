import { jsonError, jsonOk } from "@/lib/api/json";
import { isOwner, isStaff, requireEffectiveUser } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import { calendarEvents } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireEffectiveUser();
    if (!isOwner(user) && !isStaff(user)) {
      return jsonError("Staff or owner access required.", 403);
    }
    const body = (await request.json()) as {
      title?: string;
      eventDate?: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
    };
    const title = body.title?.trim();
    const eventDate = body.eventDate?.trim();
    if (!title || !eventDate) {
      return jsonError("title and eventDate are required.");
    }
    const db = getDb();
    const [row] = await db
      .insert(calendarEvents)
      .values({
        title,
        eventDate,
        startTime: body.startTime?.trim() ?? "",
        endTime: body.endTime?.trim() ?? "",
        notes: body.notes?.trim() ?? "",
        createdBy: user.email,
      })
      .returning();
    return jsonOk({ event: row }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, 500);
  }
}
