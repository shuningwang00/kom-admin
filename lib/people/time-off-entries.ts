import type { AllowlistRole } from "@/lib/auth/config";
import type { getDb } from "@/lib/db/index";
import { staffTimeOff, tutorOoo } from "@/lib/db/schema";
import {
  listStaffTimeOffTargets,
  memberPersonLabel,
} from "@/lib/people/staff-list";
import { getTutorMatch } from "@/lib/auth/user";
import {
  createStaffTimeOff,
  deleteStaffTimeOff,
  listStaffTimeOff,
  updateStaffTimeOff,
} from "@/lib/people/staff-time-off";
import type { StaffMember } from "@/lib/people/staff-list";
import {
  createTutorOoo,
  deleteTutorOoo,
  listTutorOoo,
  updateTutorOoo,
} from "@/lib/tutor-ooo/ooo";
import { compareTimeOffByProximity } from "@/lib/people/time-off-dates";
import { eq } from "drizzle-orm";

export type TimeOffEntry = {
  /** Composite ids, e.g. tutor:uuid and/or staff:uuid for one logical leave. */
  ids: string[];
  startDate: string;
  endDate: string;
  reason: string;
  personEmail: string;
  personLabel: string;
};

export function timeOffEffectsForRole(
  role: AllowlistRole | "owner" | undefined,
  tutorMatch: string,
): { tutor: boolean; staff: boolean } {
  const match = tutorMatch.trim();
  if (role === "tutor") return { tutor: Boolean(match), staff: false };
  if (role === "staff") return { tutor: false, staff: true };
  if (role === "staff_tutor") return { tutor: Boolean(match), staff: true };
  return { tutor: false, staff: false };
}

export async function resolveTimeOffPerson(
  db: ReturnType<typeof getDb>,
  email: string,
  people: StaffMember[],
): Promise<StaffMember | null> {
  const normalized = email.trim().toLowerCase();
  const hit = people.find((p) => p.email === normalized);
  if (hit) return hit;
  const tutorMatch = await getTutorMatch(normalized);
  return {
    email: normalized,
    displayName: normalized,
    fullName: normalized,
    role: tutorMatch ? "tutor" : "staff",
    tutorMatch,
  };
}

type TimeOffRow = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  personEmail: string;
  personLabel: string;
};

function mergeTimeOffRows(rows: TimeOffRow[]): TimeOffEntry[] {
  const map = new Map<string, TimeOffEntry>();
  for (const row of rows) {
    const key = `${row.personEmail}|${row.startDate}|${row.endDate}|${row.reason}`;
    const existing = map.get(key);
    if (existing) {
      existing.ids.push(row.id);
    } else {
      map.set(key, {
        ids: [row.id],
        startDate: row.startDate,
        endDate: row.endDate,
        reason: row.reason,
        personEmail: row.personEmail,
        personLabel: row.personLabel,
      });
    }
  }
  return sortTimeOffEntries([...map.values()]);
}

function sortTimeOffEntries(entries: TimeOffEntry[]): TimeOffEntry[] {
  return entries.sort((a, b) => {
    const byProximity = compareTimeOffByProximity(a, b);
    if (byProximity !== 0) return byProximity;
    return a.personLabel.localeCompare(b.personLabel);
  });
}

export async function listTimeOffEntries(
  db: ReturnType<typeof getDb>,
  person: StaffMember,
): Promise<TimeOffEntry[]> {
  const effects = timeOffEffectsForRole(person.role, person.tutorMatch ?? "");
  const raw: TimeOffRow[] = [];
  const label = memberPersonLabel(person);

  if (effects.tutor && person.tutorMatch) {
    const rows = await listTutorOoo({ tutorMatch: person.tutorMatch });
    for (const r of rows) {
      raw.push({
        id: `tutor:${r.id}`,
        startDate: r.startDate,
        endDate: r.endDate,
        reason: r.reason ?? "",
        personEmail: person.email,
        personLabel: label,
      });
    }
  }

  if (effects.staff) {
    const rows = await listStaffTimeOff(db, person.email);
    for (const r of rows) {
      raw.push({
        id: `staff:${r.id}`,
        startDate: r.startDate,
        endDate: r.endDate,
        reason: r.reason,
        personEmail: person.email,
        personLabel: label,
      });
    }
  }

  return mergeTimeOffRows(raw);
}

export async function listAllTimeOffEntries(
  db: ReturnType<typeof getDb>,
  people: StaffMember[],
): Promise<TimeOffEntry[]> {
  const labelByEmail = new Map(
    people.map((p) => [p.email, memberPersonLabel(p)]),
  );
  const personByTutorMatch = new Map(
    people
      .filter((p) => p.tutorMatch?.trim())
      .map((p) => [p.tutorMatch!.trim().toUpperCase(), p]),
  );

  const raw: TimeOffRow[] = [];

  const staffRows = await listStaffTimeOff(db);
  for (const r of staffRows) {
    raw.push({
      id: `staff:${r.id}`,
      startDate: r.startDate,
      endDate: r.endDate,
      reason: r.reason,
      personEmail: r.staffEmail,
      personLabel: labelByEmail.get(r.staffEmail) ?? r.staffEmail,
    });
  }

  const tutorRows = await listTutorOoo();
  for (const r of tutorRows) {
    const person = personByTutorMatch.get(r.tutorMatch.trim().toUpperCase());
    raw.push({
      id: `tutor:${r.id}`,
      startDate: r.startDate,
      endDate: r.endDate,
      reason: r.reason ?? "",
      personEmail: person?.email ?? "",
      personLabel: person ? memberPersonLabel(person) : r.tutorMatch,
    });
  }

  return sortTimeOffEntries(mergeTimeOffRows(raw));
}

export async function createTimeOffEntries(
  db: ReturnType<typeof getDb>,
  person: StaffMember,
  params: {
    startDate: string;
    endDate: string;
    reason: string;
    createdBy: string;
  },
): Promise<TimeOffEntry> {
  const effects = timeOffEffectsForRole(person.role, person.tutorMatch ?? "");
  const ids: string[] = [];
  const label = memberPersonLabel(person);

  if (effects.tutor) {
    if (!person.tutorMatch?.trim()) {
      throw new Error(
        "This tutor has no schedule name on Team access — add tutor match first.",
      );
    }
    const row = await createTutorOoo({
      tutorMatch: person.tutorMatch.trim(),
      startDate: params.startDate,
      endDate: params.endDate,
      reason: params.reason,
      createdBy: params.createdBy,
    });
    ids.push(`tutor:${row.id}`);
  }

  if (effects.staff) {
    const row = await createStaffTimeOff(db, {
      staffEmail: person.email,
      startDate: params.startDate,
      endDate: params.endDate,
      reason: params.reason,
      createdBy: params.createdBy,
    });
    ids.push(`staff:${row.id}`);
  }

  if (ids.length === 0) {
    throw new Error("This account cannot log time off.");
  }

  return {
    ids,
    startDate: params.startDate,
    endDate: params.endDate,
    reason: params.reason,
    personEmail: person.email,
    personLabel: label,
  };
}

export function parseTimeOffEntryId(
  compositeId: string,
): { kind: "tutor" | "staff"; id: string } | null {
  const m = compositeId.match(/^(tutor|staff):(.+)$/);
  if (!m) return null;
  return { kind: m[1] as "tutor" | "staff", id: m[2] };
}

export async function deleteTimeOffEntry(
  db: ReturnType<typeof getDb>,
  compositeId: string,
): Promise<{ personEmail: string; tutorMatch?: string } | null> {
  const parsed = parseTimeOffEntryId(compositeId);
  if (!parsed) return null;

  if (parsed.kind === "tutor") {
    const row = await deleteTutorOoo(parsed.id);
    if (!row) return null;
    return { personEmail: "", tutorMatch: row.tutorMatch };
  }

  const [row] = await db
    .select({ staffEmail: staffTimeOff.staffEmail })
    .from(staffTimeOff)
    .where(eq(staffTimeOff.id, parsed.id))
    .limit(1);
  if (!row) return null;
  await deleteStaffTimeOff(db, parsed.id);
  return { personEmail: row.staffEmail };
}

export async function deleteTimeOffEntries(
  db: ReturnType<typeof getDb>,
  compositeIds: string[],
): Promise<void> {
  for (const id of compositeIds) {
    await deleteTimeOffEntry(db, id);
  }
}

export async function updateTimeOffEntries(
  db: ReturnType<typeof getDb>,
  compositeIds: string[],
  params: { startDate: string; endDate: string; reason: string },
): Promise<TimeOffEntry | null> {
  let personEmail = "";
  let personLabel = "";

  for (const compositeId of compositeIds) {
    const parsed = parseTimeOffEntryId(compositeId);
    if (!parsed) continue;

    if (parsed.kind === "staff") {
      const row = await updateStaffTimeOff(db, parsed.id, params);
      if (row) {
        personEmail = row.staffEmail;
      }
    } else {
      const row = await updateTutorOoo(parsed.id, params);
      if (row) {
        const people = await listStaffTimeOffTargets(db);
        const person = people.find(
          (p) =>
            p.tutorMatch?.trim().toUpperCase() ===
            row.tutorMatch.trim().toUpperCase(),
        );
        if (person) {
          personEmail = person.email;
          personLabel = memberPersonLabel(person);
        }
      }
    }
  }

  if (!personEmail) {
    return {
      ids: compositeIds,
      startDate: params.startDate,
      endDate: params.endDate,
      reason: params.reason,
      personEmail: "",
      personLabel,
    };
  }

  const people = await listStaffTimeOffTargets(db);
  const person = people.find((p) => p.email === personEmail);
  if (!person) {
    return {
      ids: compositeIds,
      startDate: params.startDate,
      endDate: params.endDate,
      reason: params.reason,
      personEmail,
      personLabel: personLabel || personEmail,
    };
  }

  const entries = await listTimeOffEntries(db, person);
  return (
    entries.find((e) => e.ids.join(",") === compositeIds.join(",")) ??
    entries.find(
      (e) =>
        e.startDate === params.startDate &&
        e.endDate === params.endDate &&
        e.personEmail === personEmail,
    ) ??
    null
  );
}

/** Resolve owning email for permission checks (staff email or mapped tutor). */
export async function timeOffEntryPersonEmail(
  db: ReturnType<typeof getDb>,
  compositeIds: string[],
  people: StaffMember[],
): Promise<string | null> {
  for (const compositeId of compositeIds) {
    const parsed = parseTimeOffEntryId(compositeId);
    if (!parsed) continue;

    if (parsed.kind === "staff") {
      const [row] = await db
        .select({ staffEmail: staffTimeOff.staffEmail })
        .from(staffTimeOff)
        .where(eq(staffTimeOff.id, parsed.id))
        .limit(1);
      if (row) return row.staffEmail;
    } else {
      const [row] = await db
        .select({ tutorMatch: tutorOoo.tutorMatch })
        .from(tutorOoo)
        .where(eq(tutorOoo.id, parsed.id))
        .limit(1);
      if (!row) continue;
      const person = people.find(
        (p) =>
          p.tutorMatch?.trim().toUpperCase() ===
          row.tutorMatch.trim().toUpperCase(),
      );
      if (person) return person.email;
    }
  }
  return null;
}
