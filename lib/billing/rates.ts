import { getDefaultRatePerSession } from "@/lib/config";
import type { StudentBillingRow } from "@/lib/types";

/** Vera & Lyra — fixed rate regardless of level */
const SPECIAL_STUDENT_RATES: Record<string, number> = {
  "vera ng": 90,
  "lyra ng": 90,
};

export const LESSON_RATES = {
  lowerSecondary: 70,
  upperSecondary: 85,
  upperSecondaryBundle: 77.5,
  jc: 100,
} as const;

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function parseSection(sectionLabel: string): {
  level: "lower" | "upper" | "jc" | "unknown";
  mentionsA: boolean;
  mentionsE: boolean;
} {
  const s = sectionLabel;

  if (/(?:\bjc\b|junior college|\bj[12]\b|h2\s*math)/i.test(s)) {
    return { level: "jc", mentionsA: false, mentionsE: false };
  }

  const sec = s.match(/\bsec\s*(\d)\b/i);
  const secNum = sec ? Number(sec[1]) : null;

  const combinedAE = /\ba\s*&\s*e\b/i.test(s);
  const mentionsA = combinedAE || /\ba[\s-]?math\b/i.test(s);
  const mentionsE = combinedAE || /\be[\s-]?math\b/i.test(s);

  if (secNum === 1 || secNum === 2) {
    return { level: "lower", mentionsA, mentionsE };
  }
  if (secNum === 3 || secNum === 4) {
    return { level: "upper", mentionsA, mentionsE };
  }

  if (/\bsec\s*[12]\b|lower\s*sec/i.test(s)) {
    return { level: "lower", mentionsA, mentionsE };
  }
  if (/\bsec\s*[34]\b|upper\s*sec/i.test(s)) {
    return { level: "upper", mentionsA, mentionsE };
  }

  return { level: "unknown", mentionsA, mentionsE };
}

/** Student takes both A-Math and E-Math classes in the same month. */
export function studentHasAMathAndEMath(
  studentName: string,
  allRows: StudentBillingRow[],
): boolean {
  const key = normalizeName(studentName);
  const studentRows = allRows.filter((r) => normalizeName(r.studentName) === key);

  let hasA = false;
  let hasE = false;
  for (const row of studentRows) {
    const label = row.classLabel || row.sectionLabel;
    const p = parseSection(label);
    if (p.mentionsA) hasA = true;
    if (p.mentionsE) hasE = true;
  }
  return hasA && hasE;
}

export function resolveRatePerSession(
  row: StudentBillingRow,
  allRows: StudentBillingRow[],
): { rate: number; reason: string } {
  const special = SPECIAL_STUDENT_RATES[normalizeName(row.studentName)];
  if (special != null) {
    return { rate: special, reason: "Vera/Lyra rate" };
  }

  const tier = parseSection(row.classLabel || row.sectionLabel);

  if (tier.level === "jc") {
    return { rate: LESSON_RATES.jc, reason: "JC" };
  }
  if (tier.level === "lower") {
    return { rate: LESSON_RATES.lowerSecondary, reason: "Sec 1–2" };
  }
  if (tier.level === "upper") {
    if (studentHasAMathAndEMath(row.studentName, allRows)) {
      return {
        rate: LESSON_RATES.upperSecondaryBundle,
        reason: "Sec 3–4 A & E bundle",
      };
    }
    return { rate: LESSON_RATES.upperSecondary, reason: "Sec 3–4" };
  }

  return {
    rate: getDefaultRatePerSession(),
    reason: "Unknown class — check section label",
  };
}

export function applyRatesToRows(rows: StudentBillingRow[]): StudentBillingRow[] {
  return rows.map((row) => {
    if (row.amountPayable != null) {
      return row;
    }

    const { rate, reason } = resolveRatePerSession(row, rows);
    const tuition =
      Math.round(row.sessionCount * rate * 100) / 100;
    const computedAmount =
      Math.round((tuition + (row.registrationFee ?? 0)) * 100) / 100;
    const warnings = row.warnings.filter(
      (w) => !w.includes("default") && !w.includes("Amount Payable"),
    );

    if (row.sessionCount > 0) {
      warnings.push(`Rate: $${rate}/lesson (${reason})`);
    }

    return {
      ...row,
      ratePerSession: rate,
      computedAmount,
      warnings,
    };
  });
}
