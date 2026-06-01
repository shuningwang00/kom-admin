export const OTHER_TUTOR_VALUE = "__other__";

/** Stored on class_sessions.relief_tutor when cover is not assigned yet. */
export const RELIEF_TUTOR_NEEDED_VALUE = "__relief_tutor_needed__";

export function isReliefTutorNeeded(
  reliefTutor: string | null | undefined,
): boolean {
  return (reliefTutor ?? "").trim() === RELIEF_TUTOR_NEEDED_VALUE;
}

/** Session has a named cover tutor (not placeholder). */
export function hasAssignedReliefTutor(
  reliefTutor: string | null | undefined,
): boolean {
  const relief = (reliefTutor ?? "").trim();
  return Boolean(relief) && !isReliefTutorNeeded(relief);
}

export function isSameTutorName(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right;
}

export function tutorOptionsExcludingRegular(
  tutors: string[],
  regularTutor: string,
): string[] {
  const regular = regularTutor.trim();
  if (!regular) return tutors;
  return tutors.filter((name) => !isSameTutorName(name, regular));
}
