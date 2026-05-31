import { contactTypeEnum } from "@/lib/db/schema";

export type ContactType = (typeof contactTypeEnum.enumValues)[number];

export const CONTACT_TYPES = contactTypeEnum.enumValues;

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  mom: "Mom",
  dad: "Dad",
  parent: "Parent",
  student: "Student",
};

export type StudentContacts = {
  primaryContact: string;
  primaryContactType: ContactType | null;
  secondaryContact: string;
  secondaryContactType: ContactType | null;
};

export function formatContactLine(
  type: ContactType | null | undefined,
  number: string,
): string {
  const n = number.trim();
  if (!n) return "";
  const label = type ? CONTACT_TYPE_LABELS[type] : "Contact";
  return `${label}: ${n}`;
}

export function formatStudentContacts(c: StudentContacts): string {
  const parts = [
    formatContactLine(c.primaryContactType, c.primaryContact),
    formatContactLine(c.secondaryContactType, c.secondaryContact),
  ].filter(Boolean);
  return parts.join(" · ") || "—";
}

export function primaryContactDisplay(c: StudentContacts): string {
  return formatContactLine(c.primaryContactType, c.primaryContact) || "—";
}

export function secondaryContactDisplay(c: StudentContacts): string {
  return formatContactLine(c.secondaryContactType, c.secondaryContact) || "—";
}

/** Values used for column filter checkboxes (one per row). */
export function contactFilterValues(c: StudentContacts): [string, string] {
  return [
    `Primary: ${primaryContactDisplay(c)}`,
    `Secondary: ${secondaryContactDisplay(c)}`,
  ];
}

/** Best number for WhatsApp — primary, then secondary. */
export function bestPhoneForStudent(c: StudentContacts): string {
  return c.primaryContact.trim() || c.secondaryContact.trim();
}

export function parseContactType(raw: unknown): ContactType | null {
  const t = String(raw ?? "").trim().toLowerCase();
  if (CONTACT_TYPES.includes(t as ContactType)) return t as ContactType;
  return null;
}
