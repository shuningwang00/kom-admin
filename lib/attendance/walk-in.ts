/** Marks attendance added when a student showed up unexpectedly. */
export const WALK_IN_NOTE = "WALKIN";

export function isWalkInAttendance(makeupNote: string | null | undefined): boolean {
  return makeupNote?.trim() === WALK_IN_NOTE;
}
