import { jsonError, jsonOk } from "@/lib/api/json";
import { isTutor, requireEffectiveUser } from "@/lib/auth/access";
import { getTutorMatch } from "@/lib/auth/user";
import {
  createTutorOoo,
  listActiveTutors,
  listTutorOoo,
} from "@/lib/tutor-ooo/ooo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireEffectiveUser();
    if (!user) return jsonError("Unauthorized", 401);

    const myTutorMatch = isTutor(user) ? await getTutorMatch(user.email) : "";
    const filter = myTutorMatch ? { tutorMatch: myTutorMatch } : undefined;

    const [oooRecords, activeTutors] = await Promise.all([
      listTutorOoo(filter),
      listActiveTutors(),
    ]);

    return jsonOk({ oooRecords, activeTutors, myTutorMatch });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireEffectiveUser();
    if (!user) return jsonError("Unauthorized", 401);

    const body = (await request.json()) as Record<string, unknown>;
    const tutorMatch = String(body.tutorMatch ?? "").trim();
    const startDate = String(body.startDate ?? "").trim();
    const endDate = String(body.endDate ?? "").trim();
    const reason = String(body.reason ?? "").trim();

    if (!tutorMatch) return jsonError("tutorMatch is required.", 400);
    if (!startDate) return jsonError("startDate is required.", 400);
    if (!endDate) return jsonError("endDate is required.", 400);
    if (endDate < startDate) return jsonError("endDate must be on or after startDate.", 400);

    // Tutors can only create OOO for themselves
    if (isTutor(user)) {
      const match = await getTutorMatch(user.email);
      if (!match || match.toUpperCase() !== tutorMatch.toUpperCase()) {
        return jsonError("Tutors can only log OOO for themselves.", 403);
      }
    }

    const ooo = await createTutorOoo({
      tutorMatch,
      startDate,
      endDate,
      reason,
      createdBy: user.email,
    });

    return jsonOk({ ooo }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return jsonError(message, message === "Unauthorized" ? 401 : 500);
  }
}
