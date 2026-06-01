export type SessionExpectedCounts = {
  regular: number;
  trial: number;
  makeup: number;
  /** Pre-notified absent students — excluded from billable expected but tracked for greying out. */
  notified?: number;
};

export function formatAttendanceMarkLabel(
  marked: boolean,
  studentsToMark: number,
  savedCount = 0,
  waivedCount = 0,
): string {
  if (studentsToMark === 0) {
    return marked && waivedCount > 0 ? "Marked" : "—";
  }
  if (marked) return "Marked";
  if (savedCount > 0 && savedCount < studentsToMark) {
    return `Not marked (${savedCount}/${studentsToMark} saved)`;
  }
  return "Not marked";
}

/** e.g. "2 expected", "1 + 1 trial expected", "0 expected" */
export function formatExpectedAttendancePreview(
  counts: SessionExpectedCounts,
): string {
  const total = counts.regular + counts.trial + counts.makeup;
  if (total === 0) return "0 expected";
  const parts: string[] = [];
  if (counts.regular > 0) parts.push(String(counts.regular));
  if (counts.trial > 0) parts.push(`${counts.trial} trial`);
  if (counts.makeup > 0) parts.push(`${counts.makeup} M/U`);
  return `${parts.join(" + ")} expected`;
}

/** Daily list: expected headcount plus waived/notified modifiers. */
export function formatSessionExpectedLabel(
  expected: SessionExpectedCounts,
  waivedCount: number,
): string {
  const notifiedCount = expected.notified ?? 0;
  const activeTotal = expected.regular + expected.trial + expected.makeup;
  const parts: string[] = [];

  if (activeTotal > 0 || notifiedCount === 0) {
    parts.push(formatExpectedAttendancePreview(expected));
  }
  if (notifiedCount > 0) {
    parts.push(notifiedCount === 1 ? "1 Needs M/U" : `${notifiedCount} Needs M/U`);
  }
  if (waivedCount > 0) {
    parts.push(waivedCount === 1 ? "1 waived" : `${waivedCount} waived`);
  }
  return parts.join(" · ");
}
