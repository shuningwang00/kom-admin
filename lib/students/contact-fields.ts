import { parseContactType } from "@/lib/contacts";
import type { students } from "@/lib/db/schema";

export function contactFieldsFromBody(body: Record<string, unknown>): Partial<
  typeof students.$inferInsert
> {
  const out: Partial<typeof students.$inferInsert> = {};

  if (body.primaryContact != null) {
    out.primaryContact = String(body.primaryContact).trim();
  }
  if (body.secondaryContact != null) {
    out.secondaryContact = String(body.secondaryContact).trim();
  }
  if (body.primaryContactType !== undefined) {
    out.primaryContactType = parseContactType(body.primaryContactType);
  }
  if (body.secondaryContactType !== undefined) {
    out.secondaryContactType = parseContactType(body.secondaryContactType);
  }

  /** Legacy single contact field → primary. */
  if (body.contact != null && body.primaryContact == null) {
    out.primaryContact = String(body.contact).trim();
  }

  return out;
}

export function contactFieldsForCreate(
  body: Record<string, unknown>,
): Partial<typeof students.$inferInsert> {
  const fields = contactFieldsFromBody(body);
  return {
    primaryContact: fields.primaryContact ?? "",
    primaryContactType: fields.primaryContactType ?? "parent",
    secondaryContact: fields.secondaryContact ?? "",
    secondaryContactType: fields.secondaryContactType ?? null,
  };
}
