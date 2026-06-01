import { requireOwner } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { siteAllowlist } from "@/lib/db/schema";
import { getOwnerEmail } from "@/lib/auth/config";
import { listActiveTutors } from "@/lib/tutor-ooo/ooo";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireOwner();
    const db = getDb();
    const [rows, activeTutors] = await Promise.all([
      db.select().from(siteAllowlist).orderBy(asc(siteAllowlist.role), asc(siteAllowlist.email)),
      listActiveTutors(),
    ]);
    const owner = {
      email: getOwnerEmail(),
      displayName: process.env.OWNER_DISPLAY_NAME ?? "Shuning",
      fullName: process.env.OWNER_FULL_NAME ?? "Shuning Wang",
    };
    return jsonOk({ members: rows, activeTutors, owner });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.includes("Owner") ? 403 : 401;
    return jsonError(message, status);
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner();
    const body = (await request.json()) as {
      email?: string;
      displayName?: string;
      fullName?: string;
      tutorMatch?: string;
      role?: string;
    };
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return jsonError("Valid email is required.");
    }

    const role =
      body.role === "staff" ? "staff" :
      body.role === "staff_tutor" ? "staff_tutor" :
      "tutor";
    const hasTutorRole = role === "tutor" || role === "staff_tutor";
    if (hasTutorRole && !String(body.tutorMatch ?? "").trim()) {
      return jsonError("Tutor match is required for tutor accounts (e.g. JUNYANG).");
    }

    const db = getDb();
    const [created] = await db
      .insert(siteAllowlist)
      .values({
        email,
        role,
        displayName: String(body.displayName ?? "").trim(),
        fullName: String(body.fullName ?? "").trim(),
        tutorMatch: String(body.tutorMatch ?? "").trim(),
      })
      .returning();
    return jsonOk({ member: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.includes("duplicate") ? 409 : 403;
    return jsonError(message, status);
  }
}
