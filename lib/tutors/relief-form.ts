import {
  isReliefTutorNeeded,
  isSameTutorName,
  OTHER_TUTOR_VALUE,
  RELIEF_TUTOR_NEEDED_VALUE,
} from "@/lib/tutors/constants";

/** Stored on session: empty when the regular class tutor is teaching. */
export function resolveSessionReliefTutor(
  regularTutor: string,
  choice: string,
  otherName: string,
): string {
  if (!choice) return "";
  if (choice === RELIEF_TUTOR_NEEDED_VALUE) {
    return RELIEF_TUTOR_NEEDED_VALUE;
  }
  const relief =
    choice === OTHER_TUTOR_VALUE ? otherName.trim() : choice.trim();
  return normalizeReliefForStorage(regularTutor, relief);
}

/** Client/API may send the covering tutor name directly. */
export function normalizeReliefForStorage(
  regularTutor: string,
  reliefTutor?: string,
): string {
  const relief = reliefTutor?.trim() ?? "";
  if (isReliefTutorNeeded(relief)) return RELIEF_TUTOR_NEEDED_VALUE;
  const regular = regularTutor.trim();
  if (!relief || isSameTutorName(relief, regular)) return "";
  return relief;
}

export function initReliefTutorForm(
  reliefTutor: string,
  tutorOptions: string[],
): { choice: string; other: string } {
  const relief = reliefTutor.trim();
  if (!relief) return { choice: "", other: "" };
  if (isReliefTutorNeeded(relief)) {
    return { choice: RELIEF_TUTOR_NEEDED_VALUE, other: "" };
  }
  if (tutorOptions.includes(relief)) return { choice: relief, other: "" };
  return { choice: OTHER_TUTOR_VALUE, other: relief };
}

/** Custom makeup covering tutor — excludes “relief tutor needed” sentinel. */
export function initCoveringTutorForm(
  reliefTutor: string,
  tutorOptions: string[],
): { choice: string; other: string } {
  const relief = reliefTutor.trim();
  if (!relief || isReliefTutorNeeded(relief)) return { choice: "", other: "" };
  if (tutorOptions.includes(relief)) return { choice: relief, other: "" };
  return { choice: OTHER_TUTOR_VALUE, other: relief };
}
