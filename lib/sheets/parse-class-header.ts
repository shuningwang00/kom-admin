/** Black row format: Level + Time + Tutor (e.g. "Sec 2 9:00-10:45AM ZI NING") */
export type ParsedClassHeader = {
  level: string;
  time: string;
  tutor: string;
  full: string;
};

export const CLASS_TIME_PATTERN =
  /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}\s*(?:AM|PM)/i;

export function looksLikeClassHeader(text: string): boolean {
  const t = text.trim();
  if (!t || /^name$/i.test(t)) return false;
  const hasLevel =
    /(?:^|\s)(?:Sec|Pri|JC|IP)\s*\d/i.test(t) ||
    /\b(?:Lower|Upper)\s+Sec/i.test(t);
  const hasTime = CLASS_TIME_PATTERN.test(t);
  return hasLevel && hasTime;
}

export function parseClassHeader(header: string): ParsedClassHeader {
  const full = header.trim();
  const timeMatch = full.match(CLASS_TIME_PATTERN);

  if (!timeMatch || timeMatch.index === undefined) {
    return { level: full, time: "", tutor: "", full };
  }

  const time = timeMatch[0].trim();
  const level = full.slice(0, timeMatch.index).trim();
  const tutor = full.slice(timeMatch.index + timeMatch[0].length).trim();

  return { level, time, tutor, full };
}
