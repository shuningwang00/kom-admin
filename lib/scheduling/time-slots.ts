/** Standard KOM class length */
export const CLASS_DURATION_MINUTES = 105;

export type ParsedTimeRange = {
  timeLabel: string;
  startMinutes: number;
  endMinutes: number;
};

function toMinutes(
  hour: number,
  minute: number,
  meridiem: string | undefined,
  fallbackMeridiem?: string,
): number {
  let h = hour;
  const mer = (meridiem || fallbackMeridiem || "").toLowerCase();
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  return h * 60 + minute;
}

function formatMinutes(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const mer = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${mer}` : `${h12}${mer}`;
}

export function buildTimeLabelFromStart(startMinutes: number): string {
  const endMinutes = startMinutes + CLASS_DURATION_MINUTES;
  return `${formatMinutes(startMinutes)} – ${formatMinutes(endMinutes)}`;
}

const RANGE_SPLIT = /\s*(?:[-–]|to)\s+/i;

/** e.g. `430pm`, `1045am`, `9am`, `4:30pm` */
function parseClockToken(raw: string): {
  hour: number;
  minute: number;
  mer: string;
} | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  const withColon = text.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (withColon) {
    return {
      hour: Number(withColon[1]),
      minute: Number(withColon[2]),
      mer: withColon[3].toLowerCase(),
    };
  }

  const compact = text.match(/^(\d{1,4})\s*(am|pm)$/i);
  if (!compact) return null;

  const digits = compact[1];
  const mer = compact[2].toLowerCase();
  if (digits.length >= 3) {
    const hour = Math.floor(Number(digits) / 100);
    const minute = Number(digits) % 100;
    if (minute >= 60) return null;
    return { hour, minute, mer };
  }

  return { hour: Number(digits), minute: 0, mer };
}

function parsedRangeFromTokens(
  startToken: string,
  endToken: string,
): ParsedTimeRange | null {
  const startParts = parseClockToken(startToken);
  const endParts = parseClockToken(endToken);
  if (!startParts?.mer || !endParts?.mer) return null;

  const start = toMinutes(
    startParts.hour,
    startParts.minute,
    startParts.mer,
    endParts.mer,
  );
  let end = toMinutes(
    endParts.hour,
    endParts.minute,
    endParts.mer,
    startParts.mer,
  );
  if (end <= start) end += 12 * 60;

  return {
    timeLabel: `${formatMinutes(start)} – ${formatMinutes(end)}`,
    startMinutes: start,
    endMinutes: end,
  };
}

export function parseTimeRange(raw: string): ParsedTimeRange | null {
  const text = raw.trim();
  if (!text) return null;

  const splitParts = text.split(RANGE_SPLIT);
  if (splitParts.length === 2) {
    return parsedRangeFromTokens(splitParts[0], splitParts[1]);
  }

  const match = text.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (!match) return null;

  const startMer = match[3];
  const endMer = match[6] || startMer;
  const start = toMinutes(
    Number(match[1]),
    Number(match[2] ?? 0),
    startMer,
    endMer,
  );
  let end = toMinutes(
    Number(match[4]),
    Number(match[5] ?? 0),
    endMer,
    startMer,
  );
  if (end <= start) end += 12 * 60;

  return {
    timeLabel: `${formatMinutes(start)} – ${formatMinutes(end)}`,
    startMinutes: start,
    endMinutes: end,
  };
}

/** Single start time (e.g. `2pm`, `430pm`) → standard 1h 45m slot label. */
export function timeLabelFromStartToken(raw: string): string | null {
  const token = parseClockToken(raw.trim());
  if (!token) return null;
  const start = toMinutes(token.hour, token.minute, token.mer);
  return buildTimeLabelFromStart(start);
}

/** Normalise sheet / manual strings to canonical slot label. */
export function normalizeTimeLabel(raw: string): string | null {
  const parsed = parseTimeRange(raw);
  if (!parsed) return null;
  if (parsed.endMinutes - parsed.startMinutes !== CLASS_DURATION_MINUTES) {
    return buildTimeLabelFromStart(parsed.startMinutes);
  }
  return parsed.timeLabel;
}

/**
 * Canonical display/storage form: `6:15pm – 8pm` (en-dash, colon minutes).
 * Use for DB writes, session generation, and consolidation keys.
 */
export function canonicalTimeLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return normalizeTimeLabel(trimmed) ?? trimmed;
}

/** Centre hours: classes may start at 9am and must end by 8pm. */
export const CENTRE_OPEN_START_MINUTES = 9 * 60;
export const CENTRE_CLOSE_MINUTES = 20 * 60;

const SLOT_STEP = 15;

export function isWithinCentreHours(timeLabel: string): boolean {
  const parsed = parseTimeRange(timeLabel);
  if (!parsed) return false;
  return (
    parsed.startMinutes >= CENTRE_OPEN_START_MINUTES &&
    parsed.endMinutes <= CENTRE_CLOSE_MINUTES
  );
}

export function listStandardTimeSlots(): string[] {
  const slots: string[] = [];
  for (
    let start = CENTRE_OPEN_START_MINUTES;
    start + CLASS_DURATION_MINUTES <= CENTRE_CLOSE_MINUTES;
    start += SLOT_STEP
  ) {
    slots.push(buildTimeLabelFromStart(start));
  }
  return slots;
}

export type TimeSlotOption = { value: string; label: string };

export function rescheduleTimeOptions(
  classDefaultTime: string,
  sessionTimeLabel: string,
): TimeSlotOption[] {
  const byValue = new Map<string, string>();

  const add = (raw: string, prefix?: string, allowOutsideHours = false) => {
    const norm = normalizeTimeLabel(raw);
    if (!norm) return;
    if (!allowOutsideHours && !isWithinCentreHours(norm)) return;
    if (!byValue.has(norm)) {
      byValue.set(norm, prefix ? `${prefix}: ${norm}` : norm);
    }
  };

  add(sessionTimeLabel, "This session", true);
  if (classDefaultTime.trim() !== sessionTimeLabel.trim()) {
    add(classDefaultTime, "Class usual time", true);
  }

  for (const slot of listStandardTimeSlots()) {
    if (!byValue.has(slot)) byValue.set(slot, slot);
  }

  const legacy = sessionTimeLabel.trim();
  if (legacy) {
    const norm = normalizeTimeLabel(legacy);
    const value = norm ?? legacy;
    if (!byValue.has(value)) {
      const label = norm ? `Current: ${norm}` : `Current: ${legacy}`;
      byValue.set(value, label);
    }
  }

  return [...byValue.entries()].map(([value, label]) => ({ value, label }));
}

export function resolveRescheduleTimeLabel(
  selected: string,
  classDefaultTime: string,
): string {
  const norm = normalizeTimeLabel(selected);
  if (norm) return norm;
  const fromClass = normalizeTimeLabel(classDefaultTime);
  if (fromClass) return fromClass;
  return (
    canonicalTimeLabel(selected) || canonicalTimeLabel(classDefaultTime)
  );
}
