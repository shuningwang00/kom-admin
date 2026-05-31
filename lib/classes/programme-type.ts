export type ProgrammeLevel =
  | "p5"
  | "p6"
  | "sec1"
  | "sec2"
  | "sec3"
  | "sec4"
  | "jc1"
  | "jc2";

export type ProgrammeSubject =
  | "psle-math"
  | "g3-math"
  | "e-math"
  | "a-math"
  | "h2-math";

const LEVEL_LABEL: Record<ProgrammeLevel, string> = {
  p5: "P5",
  p6: "P6",
  sec1: "Sec 1",
  sec2: "Sec 2",
  sec3: "Sec 3",
  sec4: "Sec 4",
  jc1: "JC 1",
  jc2: "JC 2",
};

const SUBJECT_LABEL: Record<ProgrammeSubject, string> = {
  "psle-math": "Math",
  "g3-math": "G3 Math",
  "e-math": "E Math",
  "a-math": "A Math",
  "h2-math": "H2 Math",
};

/** Remove time ranges and common trailing tutor tokens before inferring type. */
export function stripTimingFromClassText(text: string): string {
  return text
    .replace(
      /\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function inferProgrammeLevel(text: string): ProgrammeLevel {
  const s = text.toLowerCase();
  if (/\bp\s*6\b|primary\s*6/.test(s)) return "p6";
  if (/\bp\s*5\b|primary\s*5/.test(s)) return "p5";
  if (/\bsec\s*1\b|\bs\s*1\b|secondary\s*1/.test(s)) return "sec1";
  if (/\bsec\s*2\b|\bs\s*2\b|secondary\s*2/.test(s)) return "sec2";
  if (/\bsec\s*3\b|\bs\s*3\b|secondary\s*3/.test(s)) return "sec3";
  if (/\bsec\s*4\b|\bs\s*4\b|secondary\s*4/.test(s)) return "sec4";
  if (/\bjc\s*2\b|\bj\s*2\b|j2\b/.test(s)) return "jc2";
  if (/\bjc\s*1\b|\bj\s*1\b|j1\b|jc\b|junior college/.test(s)) return "jc1";
  if (/\bg\s*3\b/.test(s)) return "sec2";
  return "sec2";
}

export function inferProgrammeSubject(text: string): ProgrammeSubject {
  const s = text.toLowerCase();
  if (/h2|a[-\s]?level|jc/.test(s) && /math/.test(s)) return "h2-math";
  if (/a[-\s]?math/.test(s)) return "a-math";
  if (/e[-\s]?math/.test(s)) return "e-math";
  if (/g\s*3|g3/.test(s)) return "g3-math";
  if (/psle|primary|p[56]/.test(s)) return "psle-math";
  return "g3-math";
}

function hasYearLevelInText(text: string): boolean {
  return /\b(sec|secondary|primary|jc|j[12])\s*\d|\bs\s*[1-4]\b|\bp\s*[56]\b/i.test(
    text,
  );
}

/** Level and subject as separate labels, e.g. Sec 2 + G3 Math. */
export function formatProgrammeLevelAndSubject(raw: string): {
  levelLabel: string;
  subjectLabel: string;
} {
  const cleaned = stripTimingFromClassText(raw.trim());
  if (!cleaned) return { levelLabel: "", subjectLabel: "" };

  const explicitG3A =
    /\bg\s*3\b.*\ba\s*math\b/i.test(cleaned) || /\bg3\s+a\s*math\b/i.test(cleaned);
  const hasYear = hasYearLevelInText(cleaned);
  const level = inferProgrammeLevel(cleaned);
  const subject = inferProgrammeSubject(cleaned);

  if (explicitG3A && !hasYear) {
    return { levelLabel: "", subjectLabel: "G3 A Math" };
  }

  if (explicitG3A || (subject === "a-math" && /\bg\s*3\b/i.test(cleaned))) {
    return {
      levelLabel: hasYear ? LEVEL_LABEL[level] : "",
      subjectLabel: "G3 A Math",
    };
  }

  const subjectLabel = SUBJECT_LABEL[subject];
  if (!hasYear && subject === "g3-math") {
    return { levelLabel: "", subjectLabel: "G3 Math" };
  }
  if (!hasYear && subject === "a-math") {
    return { levelLabel: "", subjectLabel: "A Math" };
  }
  if (!hasYear && subject === "e-math") {
    return { levelLabel: "", subjectLabel: "E Math" };
  }
  if (!hasYear && subject === "h2-math") {
    return { levelLabel: "", subjectLabel: "H2 Math" };
  }

  return {
    levelLabel: hasYear ? LEVEL_LABEL[level] : "",
    subjectLabel,
  };
}

/** Human-readable programme type, e.g. "Sec 2 G3 Math", "G3 A Math", "Sec 4 A Math". */
export function formatProgrammeTypeLabel(raw: string): string {
  const { levelLabel, subjectLabel } = formatProgrammeLevelAndSubject(raw);
  if (!levelLabel && !subjectLabel) return "Class";
  return [levelLabel, subjectLabel].filter(Boolean).join(" ");
}
