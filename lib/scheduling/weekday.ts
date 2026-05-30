import { weekdayEnum } from "@/lib/db/schema";

export type Weekday = (typeof weekdayEnum.enumValues)[number];

const TAB_TO_WEEKDAY: Array<{ match: RegExp; day: Weekday }> = [
  { match: /mon/i, day: "monday" },
  { match: /tue/i, day: "tuesday" },
  { match: /wed/i, day: "wednesday" },
  { match: /thu/i, day: "thursday" },
  { match: /fri/i, day: "friday" },
  { match: /sat/i, day: "saturday" },
  { match: /sun/i, day: "sunday" },
];

export function weekdayFromSheetTab(tabName: string): Weekday {
  const t = tabName.trim();
  for (const { match, day } of TAB_TO_WEEKDAY) {
    if (match.test(t)) return day;
  }
  return "other";
}
