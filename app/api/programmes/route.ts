import { assertCanManageStudents, assertCanReadRoster } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { holidayProgrammes } from "@/lib/db/schema";
import { listProgrammes } from "@/lib/programmes/list";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await assertCanReadRoster();
    const programmes = await listProgrammes();
    return jsonOk({ programmes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}

export async function POST(request: Request) {
  try {
    await assertCanManageStudents();
    const body = (await request.json()) as Record<string, unknown>;

    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Programme name is required.");

    const db = getDb();
    const [created] = await db
      .insert(holidayProgrammes)
      .values({ name })
      .returning();

    return jsonOk({ programme: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized" ? 401 : message.includes("DATABASE_URL") ? 503 : 500;
    return jsonError(message, status);
  }
}
