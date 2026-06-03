import { getDb } from "@/lib/db/index";
import { staffClaims } from "@/lib/db/schema";
import { and, asc, count, eq, gte, lte } from "drizzle-orm";

export type StaffClaim = typeof staffClaims.$inferSelect;

export const CLAIM_CATEGORIES = [
  "Printing/Stationery",
  "Transport",
  "Cleaning",
  "Others",
] as const;

export type ClaimCategory = typeof CLAIM_CATEGORIES[number];

export async function listClaimsForMonth(
  month: string,
  opts: { email?: string; status?: string } = {},
): Promise<StaffClaim[]> {
  const db = getDb();
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end = new Date(y, m, 0).toISOString().slice(0, 10);

  const conditions = [
    gte(staffClaims.claimDate, start),
    lte(staffClaims.claimDate, end),
  ];
  if (opts.email) conditions.push(eq(staffClaims.staffEmail, opts.email));
  if (opts.status) conditions.push(eq(staffClaims.status, opts.status));

  return db
    .select()
    .from(staffClaims)
    .where(and(...conditions))
    .orderBy(asc(staffClaims.claimDate));
}

export async function createClaim(data: {
  staffEmail: string;
  staffName: string;
  claimDate: string;
  amount: string;
  category: string;
  description: string;
  receiptFileId?: string;
  receiptFileName?: string;
}): Promise<StaffClaim> {
  const db = getDb();
  const [row] = await db.insert(staffClaims).values(data).returning();
  return row;
}

export async function reviewClaim(
  id: string,
  decision: { status: "approved" | "rejected"; rejectionReason?: string; reviewedBy: string },
): Promise<StaffClaim | null> {
  const db = getDb();
  const [row] = await db
    .update(staffClaims)
    .set({
      status: decision.status,
      rejectionReason: decision.rejectionReason ?? null,
      reviewedBy: decision.reviewedBy,
      reviewedAt: new Date(),
    })
    .where(eq(staffClaims.id, id))
    .returning();
  return row ?? null;
}

export async function getPendingClaimsCount(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(staffClaims)
    .where(eq(staffClaims.status, "pending"));
  return Number(row?.n ?? 0);
}

export async function getClaim(id: string): Promise<StaffClaim | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(staffClaims)
    .where(eq(staffClaims.id, id));
  return row ?? null;
}

export async function updateClaim(
  id: string,
  data: Partial<{
    claimDate: string;
    amount: string;
    category: string;
    description: string;
    receiptFileId: string | null;
    receiptFileName: string | null;
  }>,
): Promise<StaffClaim | null> {
  const db = getDb();
  const [row] = await db
    .update(staffClaims)
    .set(data)
    .where(eq(staffClaims.id, id))
    .returning();
  return row ?? null;
}

export async function deleteClaim(id: string): Promise<StaffClaim | null> {
  const db = getDb();
  const [row] = await db
    .delete(staffClaims)
    .where(eq(staffClaims.id, id))
    .returning();
  return row ?? null;
}
