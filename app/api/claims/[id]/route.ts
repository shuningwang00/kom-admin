import { jsonError, jsonOk } from "@/lib/api/json";
import { isOwnerOrAdmin, requireEffectiveUser } from "@/lib/auth/access";
import { getClaim, reviewClaim } from "@/lib/people/claims";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireEffectiveUser();
    if (!await isOwnerOrAdmin(user)) return jsonError("Forbidden", 403);

    const { id } = await params;
    const body = (await request.json()) as {
      status?: string;
      rejectionReason?: string;
    };

    if (body.status !== "approved" && body.status !== "rejected") {
      return jsonError("status must be 'approved' or 'rejected'.");
    }

    const existing = await getClaim(id);
    if (!existing) return jsonError("Claim not found.", 404);

    const updated = await reviewClaim(id, {
      status: body.status,
      rejectionReason: body.rejectionReason,
      reviewedBy: user.email,
    });

    return jsonOk({ claim: updated });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}
