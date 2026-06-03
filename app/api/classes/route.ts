import {
  assertCanMutateClasses,
  assertCanReadRoster,
  isOwnerOrAdmin,
} from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { syncClassesFromSheetIfConfigured } from "@/lib/classes-sheet/sync";
import { getDb } from "@/lib/db/index";
import { classes, weekdayEnum } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const WEEKDAYS = weekdayEnum.enumValues;

export async function GET(request: Request) {
  try {
    const user = await assertCanReadRoster();
    const activeOnly = new URL(request.url).searchParams.get("all") !== "1";
    const db = getDb();
    const forceSync = new URL(request.url).searchParams.get("refresh") === "1";
    const [sync, canEdit] = await Promise.all([
      syncClassesFromSheetIfConfigured(db, forceSync),
      isOwnerOrAdmin(user),
    ]);
    const rows = await db
      .select()
      .from(classes)
      .where(activeOnly ? eq(classes.isActive, true) : undefined)
      .orderBy(asc(classes.weekday), asc(classes.time), asc(classes.label));
    return jsonOk({ classes: rows, weekdays: WEEKDAYS, sheetSync: sync, canEdit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    await assertCanMutateClasses();
    const body = (await request.json()) as {
      label?: string;
      level?: string;
      time?: string;
      tutor?: string;
      weekday?: string;
      feePerLesson?: string;
      description?: string;
      isFull?: boolean;
    };
    const label = String(body.label ?? "").trim();
    if (!label) return jsonError("Class label is required.");
    const weekday = WEEKDAYS.includes(body.weekday as (typeof WEEKDAYS)[number])
      ? (body.weekday as (typeof WEEKDAYS)[number])
      : "other";

    const db = getDb();
    const [created] = await db
      .insert(classes)
      .values({
        label,
        level: String(body.level ?? "").trim(),
        time: String(body.time ?? "").trim(),
        tutor: String(body.tutor ?? "").trim(),
        weekday,
        feePerLesson: String(body.feePerLesson ?? "").trim(),
        description: String(body.description ?? "").trim(),
        isFull: body.isFull === true,
      })
      .returning();
    return jsonOk({ class: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized" ? 401 : message.includes("cannot") ? 403 : 500;
    return jsonError(message, status);
  }
}
