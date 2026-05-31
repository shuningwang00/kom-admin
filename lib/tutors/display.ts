import { isReliefTutorNeeded } from "@/lib/tutors/constants";

/** Who is teaching this session (relief overrides class tutor). */
export function sessionTutorDisplay(
  classTutor: string,
  reliefTutor: string,
): { primary: string; subtitle: string | null } {
  const regular = classTutor.trim() || "—";
  const relief = reliefTutor.trim();
  if (!relief) {
    return { primary: regular, subtitle: null };
  }
  if (isReliefTutorNeeded(relief)) {
    return {
      primary: "Relief tutor needed",
      subtitle: `Regular: ${regular}`,
    };
  }
  return {
    primary: relief,
    subtitle: `Relief (regular: ${regular})`,
  };
}

/** Read-only label after relief tutor is saved on the session. */
export function reliefTutorSavedLabel(
  classTutor: string,
  reliefTutor: string,
): string {
  const regular = classTutor.trim() || "—";
  const relief = reliefTutor.trim();
  if (!relief) {
    return `${regular} (regular tutor)`;
  }
  if (isReliefTutorNeeded(relief)) {
    return "Relief tutor needed";
  }
  const { primary, subtitle } = sessionTutorDisplay(classTutor, relief);
  if (subtitle) return `${primary} · ${subtitle}`;
  return primary;
}
