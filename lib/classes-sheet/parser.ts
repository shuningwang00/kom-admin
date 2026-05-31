import { formatProgrammeTypeLabel } from "@/lib/classes/programme-type";
import type { Weekday } from "@/lib/scheduling/weekday";

export type SheetClassStatus = "active" | "dummy" | "full";

export type ParsedSheetClass = {
  id: string;
  status: SheetClassStatus;
  weekday: Weekday;
  label: string;
  level: string;
  time: string;
  tutor: string;
  signupLabel: string;
};

function normHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugify(parts: string[]): string {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const HEADER_ALIASES: Record<string, string[]> = {
  status: ["status", "class status", "availability", "state"],
  day: ["day", "weekday", "week day"],
  class: ["class", "class name", "label", "name", "description", "programme"],
  level: ["level", "grade", "year", "type", "class type", "programme type"],
  subject: ["subject", "stream", "course"],
  time: ["time", "time slot", "slot", "timing"],
  tutor: ["tutor", "teacher", "instructor"],
};

function findHeader(rows: string[][]): {
  index: number;
  col: Record<string, number>;
} | null {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const line = rows[i] ?? [];
    const normalized = line.map(normHeader);
    const col: Record<string, number> = {};
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      const idx = normalized.findIndex((h) => aliases.includes(h));
      if (idx >= 0) col[key] = idx;
    }
    if (col.status != null && (col.day != null || col.class != null)) {
      return { index: i, col };
    }
  }
  return null;
}

export function parseDayToWeekday(raw: string): Weekday | null {
  const s = raw.trim().toLowerCase();
  if (/^mon(day)?$/.test(s) || s === "m") return "monday";
  if (/^tue(s(day)?)?$/.test(s) || s === "tu") return "tuesday";
  if (/^wed(nesday)?$/.test(s) || s === "w") return "wednesday";
  if (/^thu(r(s(day)?)?)?$/.test(s) || s === "th") return "thursday";
  if (/^fri(day)?$/.test(s) || s === "f") return "friday";
  if (/^sat(urday)?$/.test(s) || s === "sa") return "saturday";
  if (/^sun(day)?$/.test(s) || s === "su") return "sunday";
  return null;
}

function parseStatus(raw: string, classText: string): SheetClassStatus {
  const s = raw.trim().toLowerCase();
  if (s.includes("dummy") || /dummy/i.test(classText)) return "dummy";
  if (s.includes("full") || s.includes("waitlist")) return "full";
  return "active";
}

function formatTimeLabel(raw: string): string {
  const text = raw.trim();
  const match = text.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (!match) return text;
  return text;
}

const DAY_SHORT: Record<Weekday, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
  other: "Day",
};

export function parseClassesFromSheetRows(rows: string[][]): ParsedSheetClass[] {
  const header = findHeader(rows);
  if (!header) {
    throw new Error(
      'Could not find header row with "Status" and "Day" or "Class" columns.',
    );
  }

  const parsed: ParsedSheetClass[] = [];

  for (let i = header.index + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const get = (key: string) => {
      const idx = header.col[key];
      return idx == null ? "" : String(row[idx] ?? "").trim();
    };

    const statusRaw = get("status");
    const classText = get("class") || get("level");
    if (!classText && !get("time")) continue;

    const status = parseStatus(statusRaw, classText);
    const weekday = parseDayToWeekday(get("day"));
    if (!weekday) continue;

    const subjectCol = get("subject");
    const levelCol = get("level");
    const label =
      classText ||
      `${levelCol} ${subjectCol}`.trim() ||
      "Class";
    const time = formatTimeLabel(get("time"));
    if (!time) continue;

    const tutor = get("tutor");
    const levelText = [levelCol, classText, subjectCol].filter(Boolean).join(" ");
    const programmeType = formatProgrammeTypeLabel(levelText);
    const id = slugify([weekday, label, time, tutor]);

    parsed.push({
      id,
      status,
      weekday,
      label,
      level: programmeType,
      time,
      tutor,
      signupLabel: `${DAY_SHORT[weekday]} · ${programmeType} · ${time}${
        tutor ? ` · ${tutor}` : ""
      }`,
    });
  }

  return parsed;
}
