import { requireOwner } from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { getDb } from "@/lib/db/index";
import { siteAllowlist } from "@/lib/db/schema";
import { getOwnerEmail } from "@/lib/auth/config";
import { RELIEF_TUTOR_PERMISSIONS_JSON } from "@/lib/auth/relief-tutor";
import { alignAllowlistTutorNamesFromClasses } from "@/lib/classes-sheet/align-tutor-names";
import { listReliefOnlyTutors } from "@/lib/tutors/relief-only-tutors";
import { listScheduleTutorNames } from "@/lib/tutors/schedule-tutors";
import { listTutorOptions } from "@/lib/tutors/options";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireOwner();
    const db = getDb();
    await alignAllowlistTutorNamesFromClasses(db);
    const [rows, scheduleTutors, reliefOnlyTutors, activeTutors] =
      await Promise.all([
        db
          .select()
          .from(siteAllowlist)
          .orderBy(asc(siteAllowlist.role), asc(siteAllowlist.email)),
        listScheduleTutorNames(),
        listReliefOnlyTutors(db),
        listTutorOptions(),
      ]);
    const owner = {
      email: getOwnerEmail(),
      displayName: process.env.OWNER_DISPLAY_NAME ?? "Shuning",
      fullName: process.env.OWNER_FULL_NAME ?? "Shuning Wang",
    };
    return jsonOk({
      members: rows,
      scheduleTutors,
      reliefOnlyTutors,
      activeTutors,
      owner,
    });
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
      alsoReliefTutor?: boolean;
    };
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return jsonError("Valid email is required.");
    }

    const role =
      body.role === "staff"
        ? "staff"
        : body.role === "staff_tutor"
          ? "staff_tutor"
          : body.role === "relief_tutor"
            ? "relief_tutor"
            : "tutor";
    const db = getDb();
    let fullName = String(body.fullName ?? "").trim();
    let tutorMatch = String(body.tutorMatch ?? "").trim();
    let displayName = String(body.displayName ?? "").trim();

    if (role === "relief_tutor") {
      if (!displayName) return jsonError("Display name is required.", 400);
      if (!email) return jsonError("Valid email is required.", 400);
      tutorMatch = displayName;
      fullName = fullName || displayName;
    } else {
      const hasTutorRole = role === "tutor" || role === "staff_tutor";
      if (hasTutorRole && !tutorMatch) {
        return jsonError("Tutor match is required for tutor accounts.", 400);
      }
      displayName = displayName || tutorMatch || fullName;
    }

    const alsoReliefTutor =
      Boolean(body.alsoReliefTutor) &&
      (role === "staff" || role === "staff_tutor");

    const [created] = await db
      .insert(siteAllowlist)
      .values({
        email,
        role,
        displayName,
        fullName: fullName || displayName,
        tutorMatch,
        alsoReliefTutor,
        ...(role === "relief_tutor"
          ? { permissionsJson: RELIEF_TUTOR_PERMISSIONS_JSON }
          : {}),
      })
      .returning();
    return jsonOk({ member: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.includes("duplicate") ? 409 : 403;
    return jsonError(message, status);
  }
}
