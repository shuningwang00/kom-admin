import { jsonError, jsonOk } from "@/lib/api/json";
import { requireOwner } from "@/lib/auth/access";
import { getDb } from "@/lib/db/index";
import {
  addReliefOnlyTutor,
  listReliefOnlyTutors,
} from "@/lib/tutors/relief-only-tutors";

export const dynamic = "force-dynamic";

/** Legacy name-only rows (pre–portal relief list). Prefer Team access → Relief tutors. */
export async function GET() {
  try {
    await requireOwner();
    const db = getDb();
    const tutors = await listReliefOnlyTutors(db);
    return jsonOk({ tutors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message.includes("Owner") ? 403 : 401;
    return jsonError(message, status);
  }
}

export async function POST() {
  return jsonError(
    "Add relief tutors under Team access → Relief tutors (display name + email).",
    400,
  );
}
