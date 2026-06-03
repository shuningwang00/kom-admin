import { jsonError, jsonOk } from "@/lib/api/json";
import { isOwner, isOwnerOrAdmin, requireEffectiveUser } from "@/lib/auth/access";
import { uploadReceiptToDrive } from "@/lib/google/drive";
import { createClaim, listClaimsForMonth } from "@/lib/people/claims";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireEffectiveUser();
    const params = new URL(request.url).searchParams;
    const month = params.get("month")?.trim();
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return jsonError("Query ?month=YYYY-MM required.");
    }
    const status = params.get("status")?.trim() || undefined;
    const elevated = await isOwnerOrAdmin(user);
    const filterEmail = elevated ? undefined : user.email;
    const claims = await listClaimsForMonth(month, { email: filterEmail, status });
    return jsonOk({ claims, isOwner: elevated, userEmail: user.email });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load claims";
    return jsonError(msg, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireEffectiveUser();
    const elevated = await isOwnerOrAdmin(user);

    const contentType = request.headers.get("content-type") ?? "";
    let body: {
      staffEmail?: string;
      staffName?: string;
      claimDate?: string;
      amount?: string;
      category?: string;
      description?: string;
    };
    let fileBuffer: Buffer | undefined;
    let fileName: string | undefined;
    let fileMime: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      body = {
        staffEmail: form.get("staffEmail")?.toString(),
        staffName: form.get("staffName")?.toString(),
        claimDate: form.get("claimDate")?.toString(),
        amount: form.get("amount")?.toString(),
        category: form.get("category")?.toString(),
        description: form.get("description")?.toString(),
      };
      const file = form.get("receipt");
      if (file && file instanceof File && file.size > 0) {
        fileBuffer = Buffer.from(await file.arrayBuffer());
        fileName = file.name;
        fileMime = file.type || "application/octet-stream";
      }
    } else {
      body = (await request.json()) as typeof body;
    }

    const { claimDate, amount, category, description } = body;
    if (!claimDate || !amount || !category) {
      return jsonError("claimDate, amount and category are required.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(claimDate)) {
      return jsonError("claimDate must be YYYY-MM-DD.");
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return jsonError("amount must be a positive number.");
    }

    const targetEmail = elevated && body.staffEmail ? body.staffEmail : user.email;
    const targetName = elevated && body.staffName ? body.staffName : (user.displayName || user.email);

    let receiptFileId: string | undefined;
    let receiptFileName: string | undefined;

    if (fileBuffer && fileName && fileMime) {
      const month = claimDate.slice(0, 7);
      const result = await uploadReceiptToDrive(fileBuffer, fileName, fileMime, month);
      receiptFileId = result.fileId;
      receiptFileName = result.fileName;
    }

    const claim = await createClaim({
      staffEmail: targetEmail,
      staffName: targetName,
      claimDate,
      amount: amountNum.toFixed(2),
      category,
      description: description ?? "",
      receiptFileId,
      receiptFileName,
    });

    return jsonOk({ claim }, 201);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Failed to create claim";
    const msg = raw.includes("invalid_grant")
      ? "Google Drive is not connected or the token has expired. Go to the Billing page and click 'Connect Google' to re-authorize."
      : raw;
    return jsonError(msg, 500);
  }
}
