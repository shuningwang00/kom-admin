import { jsonError, jsonOk } from "@/lib/api/json";
import { isOwnerOrAdmin, requireEffectiveUser } from "@/lib/auth/access";
import { deleteFileFromDrive, uploadReceiptToDrive } from "@/lib/google/drive";
import { deleteClaim, getClaim, reviewClaim, updateClaim } from "@/lib/people/claims";

export const dynamic = "force-dynamic";

/** Owner only: approve or reject a claim. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireEffectiveUser();
    const { id } = await params;

    const existing = await getClaim(id);
    if (!existing) return jsonError("Claim not found.", 404);

    const contentType = request.headers.get("content-type") ?? "";

    // --- Edit mode (staff editing their own pending claim, or owner editing any) ---
    if (!contentType.includes("application/json")) {
      const canEdit =
        (await isOwnerOrAdmin(user)) ||
        (existing.staffEmail === user.email && existing.status === "pending");
      if (!canEdit) return jsonError("Forbidden", 403);

      const form = await request.formData();
      const updates: Parameters<typeof updateClaim>[1] = {};

      const claimDate = form.get("claimDate")?.toString().trim();
      const amount = form.get("amount")?.toString().trim();
      const category = form.get("category")?.toString().trim();
      const description = form.get("description")?.toString().trim();
      if (claimDate) updates.claimDate = claimDate;
      if (amount) updates.amount = parseFloat(amount).toFixed(2);
      if (category) updates.category = category;
      if (description !== undefined) updates.description = description ?? "";

      const file = form.get("receipt");
      if (file && file instanceof File && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const month = (claimDate ?? existing.claimDate).slice(0, 7);
        const result = await uploadReceiptToDrive(buffer, file.name, file.type || "application/octet-stream", month);
        if (existing.receiptFileId) await deleteFileFromDrive(existing.receiptFileId);
        updates.receiptFileId = result.fileId;
        updates.receiptFileName = result.fileName;
      }

      const updated = await updateClaim(id, updates);
      return jsonOk({ claim: updated });
    }

    // --- Review mode (owner only: approve/reject) ---
    if (!await isOwnerOrAdmin(user)) return jsonError("Forbidden", 403);

    const body = (await request.json()) as { status?: string; rejectionReason?: string };
    if (body.status !== "approved" && body.status !== "rejected") {
      return jsonError("status must be 'approved' or 'rejected'.");
    }

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

/** Staff can delete their own pending claim; owner can delete any. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireEffectiveUser();
    const { id } = await params;

    const existing = await getClaim(id);
    if (!existing) return jsonError("Claim not found.", 404);

    const elevated = await isOwnerOrAdmin(user);
    if (!elevated && (existing.staffEmail !== user.email || existing.status !== "pending")) {
      return jsonError("Forbidden", 403);
    }

    if (existing.receiptFileId) await deleteFileFromDrive(existing.receiptFileId);
    await deleteClaim(id);
    return jsonOk({ deleted: true });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}
