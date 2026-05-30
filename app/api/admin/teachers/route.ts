import { requireOwner } from "@/lib/auth/access";
import { hasSitePasswordAuth } from "@/lib/auth/password";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { siteAllowlist } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await hasSitePasswordAuth())) {
      return jsonError("Unauthorized", 401);
    }
    await requireOwner();
    const db = getDb();
    const rows = await db
      .select()
      .from(siteAllowlist)
      .orderBy(asc(siteAllowlist.role), asc(siteAllowlist.email));
    return jsonOk({ members: rows, tutors: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.includes("Owner") ? 403 : 401;
    return jsonError(message, status);
  }
}

export async function POST(request: Request) {
  try {
    if (!(await hasSitePasswordAuth())) {
      return jsonError("Unauthorized", 401);
    }
    await requireOwner();
    const body = (await request.json()) as {
      email?: string;
      displayName?: string;
      tutorMatch?: string;
      role?: string;
    };
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return jsonError("Valid email is required.");
    }

    const role = body.role === "staff" ? "staff" : "tutor";
    if (role === "tutor" && !String(body.tutorMatch ?? "").trim()) {
      return jsonError("Tutor match is required for tutor accounts (e.g. JUNYANG).");
    }

    const db = getDb();
    const [created] = await db
      .insert(siteAllowlist)
      .values({
        email,
        role,
        displayName: String(body.displayName ?? "").trim(),
        tutorMatch: String(body.tutorMatch ?? "").trim(),
      })
      .returning();
    return jsonOk({ member: created, tutor: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.includes("duplicate") ? 409 : 403;
    return jsonError(message, status);
  }
}
