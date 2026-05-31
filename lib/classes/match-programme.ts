import {
  formatProgrammeLevelAndSubject,
  formatProgrammeTypeLabel,
  inferProgrammeLevel,
  inferProgrammeSubject,
  type ProgrammeLevel,
  type ProgrammeSubject,
} from "@/lib/classes/programme-type";

export type ProgrammeKey = {
  level: ProgrammeLevel;
  subject: ProgrammeSubject;
};

export function programmeKeyFromClass(c: {
  level: string;
  label: string;
}): ProgrammeKey {
  const combined = [c.level, c.label].filter(Boolean).join(" ");
  return {
    level: inferProgrammeLevel(combined),
    subject: inferProgrammeSubject(combined),
  };
}

export function sameProgramme(
  a: { level: string; label: string },
  b: { level: string; label: string },
): boolean {
  const ka = programmeKeyFromClass(a);
  const kb = programmeKeyFromClass(b);
  return ka.level === kb.level && ka.subject === kb.subject;
}

export function sameProgrammeLevel(
  a: { level: string; label: string },
  b: { level: string; label: string },
): boolean {
  return programmeKeyFromClass(a).level === programmeKeyFromClass(b).level;
}

export function programmeTypeLabel(c: { level: string; label: string }): string {
  const combined = [c.level, c.label].filter(Boolean).join(" ");
  return formatProgrammeTypeLabel(combined);
}

/** Level and subject as separate labels for session previews, e.g. Sec 2 + G3 Math. */
export function programmeLevelSubjectLabels(c: {
  level: string;
  label: string;
}): { levelLabel: string; subjectLabel: string } {
  const combined = [c.level, c.label].filter(Boolean).join(" ");
  return formatProgrammeLevelAndSubject(combined);
}

export function programmeLevelSubjectLine(c: {
  level: string;
  label: string;
}): string {
  const { levelLabel, subjectLabel } = programmeLevelSubjectLabels(c);
  return [levelLabel, subjectLabel].filter(Boolean).join(" · ");
}
