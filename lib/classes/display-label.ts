import { formatProgrammeTypeLabel } from "@/lib/classes/programme-type";

/** Fields stored on `classes` from sheet sync. */
export type ClassDisplayFields = {
  label: string;
  level: string;
  time: string;
  tutor: string;
  weekday: string;
};

export const WEEKDAY_SHORT: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
  other: "",
};

/** Programme type, e.g. "Sec 2 G3 A Math" — inferred from sheet columns or class text. */
export function formatClassTypeLabel(c: Pick<ClassDisplayFields, "label" | "level">): string {
  const label = c.label.trim();
  const levelField = c.level.trim();

  const combined = [levelField, label].filter(Boolean).join(" ");
  const inferred = formatProgrammeTypeLabel(combined);
  if (inferred !== "Class") return inferred;

  if (levelField && levelField !== label) {
    return formatProgrammeTypeLabel(levelField);
  }

  return label || "Class";
}

export function formatWeekdayLabel(weekday: string): string {
  const short = WEEKDAY_SHORT[weekday];
  if (short) return short;
  if (!weekday) return "—";
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

/** Dropdown / picker label: day · type · time · tutor (optional). */
export function formatClassDropdownLabel(c: ClassDisplayFields): string {
  const day = WEEKDAY_SHORT[c.weekday] ?? c.weekday;
  const type = formatClassTypeLabel(c);
  const time = c.time.trim();
  const tutor = c.tutor.trim();
  const parts: string[] = [];
  if (day) parts.push(day);
  parts.push(type);
  if (time) parts.push(time);
  if (tutor) parts.push(tutor);
  return parts.join(" · ");
}
