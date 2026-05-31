import { formatClassDropdownLabel } from "@/lib/classes/display-label";
import { formatProgrammeTypeLabel } from "@/lib/classes/programme-type";
import type { classes, enrollments, students } from "@/lib/db/schema";
import {
  studentRosterStatus,
  type StudentRosterStatus,
} from "@/lib/students/roster-status";

type StudentRow = typeof students.$inferSelect;
type ClassRow = typeof classes.$inferSelect;
type EnrollmentRow = typeof enrollments.$inferSelect;

export type StudentEnrollmentView = {
  id: string;
  freeTrial: boolean;
  registrationFeeDue: boolean;
  startedAt: string | null;
  pauseStartedAt: string | null;
  pauseEndedAt: string | null;
  notes: string;
  classLabel: string;
};

export type WithdrawnEnrollmentView = StudentEnrollmentView & {
  endedAt: string | null;
};

export type StudentRosterItem = StudentRow & {
  billingGroupLabel: string | null;
  levelDisplay: string;
  classesEnrolledDisplay: string;
  rosterStatus: StudentRosterStatus;
  siblingNames: string[];
  activeEnrollments: StudentEnrollmentView[];
  withdrawnEnrollments: WithdrawnEnrollmentView[];
};

const YEAR_LEVEL_RE =
  /\b(Sec\s*[1-4]|JC\s*[12]|J[12]|P\s*[56]|S\s*[1-4]|Primary\s*[56])\b/i;

function normalizeYearLevel(raw: string): string {
  const s = raw.trim();
  const sec = s.match(/\bSec\s*(\d)\b/i);
  if (sec) return `Sec ${sec[1]}`;
  const jc = s.match(/\bJC\s*(\d)\b/i) || s.match(/\bJ(\d)\b/i);
  if (jc) return `JC ${jc[1]}`;
  const p = s.match(/\bP\s*(\d)\b/i) || s.match(/\bPrimary\s*(\d)\b/i);
  if (p) return `P${p[1]}`;
  const secShort = s.match(/\bS\s*(\d)\b/i);
  if (secShort) return `Sec ${secShort[1]}`;
  return s;
}

function yearLevelFromText(text: string): string | null {
  const m = text.match(YEAR_LEVEL_RE);
  if (!m) return null;
  return normalizeYearLevel(m[0]);
}

export function deriveStudentLevelDisplay(
  school: string,
  classLevelFields: string[],
): string {
  const fromSchool = yearLevelFromText(school);
  if (fromSchool) return fromSchool;

  const fromClasses = new Set<string>();
  for (const field of classLevelFields) {
    const fromField = yearLevelFromText(field);
    if (fromField) {
      fromClasses.add(fromField);
      continue;
    }
    const programme = formatProgrammeTypeLabel(field);
    const fromProgramme = yearLevelFromText(programme);
    if (fromProgramme) fromClasses.add(fromProgramme);
  }

  if (fromClasses.size > 0) {
    return [...fromClasses].sort().join(" · ");
  }

  return "—";
}

export function buildStudentRoster(
  studentRows: Array<{
    student: StudentRow;
    billingGroupLabel: string | null;
  }>,
  enrollmentRows: Array<{
    enrollment: EnrollmentRow;
    class: ClassRow;
  }>,
): StudentRosterItem[] {
  const activeByStudent = new Map<string, StudentEnrollmentView[]>();
  const withdrawnByStudent = new Map<string, WithdrawnEnrollmentView[]>();
  const classLevelsByStudent = new Map<string, string[]>();

  for (const { enrollment, class: cls } of enrollmentRows) {
    const sid = enrollment.studentId;
    const entry = {
      id: enrollment.id,
      freeTrial: enrollment.freeTrial,
      registrationFeeDue: enrollment.registrationFeeDue,
      startedAt: enrollment.startedAt,
      pauseStartedAt: enrollment.pauseStartedAt,
      pauseEndedAt: enrollment.pauseEndedAt,
      notes: enrollment.notes,
      classLabel: formatClassDropdownLabel(cls),
    };

    if (enrollment.endedAt) {
      const list = withdrawnByStudent.get(sid) ?? [];
      list.push({ ...entry, endedAt: enrollment.endedAt });
      withdrawnByStudent.set(sid, list);
    } else {
      const list = activeByStudent.get(sid) ?? [];
      list.push(entry);
      activeByStudent.set(sid, list);

      const levels = classLevelsByStudent.get(sid) ?? [];
      levels.push(cls.level, cls.label);
      classLevelsByStudent.set(sid, levels);
    }
  }

  const siblingsByGroup = new Map<string, Array<{ id: string; name: string }>>();
  for (const { student } of studentRows) {
    if (!student.billingGroupId) continue;
    const list = siblingsByGroup.get(student.billingGroupId) ?? [];
    list.push({ id: student.id, name: student.name });
    siblingsByGroup.set(student.billingGroupId, list);
  }

  return studentRows.map(({ student, billingGroupLabel }) => {
    const activeEnrollments = activeByStudent.get(student.id) ?? [];
    const withdrawnEnrollments = withdrawnByStudent.get(student.id) ?? [];
    const classLevels = classLevelsByStudent.get(student.id) ?? [];
    const siblingNames =
      student.billingGroupId != null
        ? (siblingsByGroup.get(student.billingGroupId) ?? [])
            .filter((s) => s.id !== student.id)
            .map((s) => s.name)
            .sort((a, b) => a.localeCompare(b))
        : [];

    return {
      ...student,
      billingGroupLabel,
      levelDisplay: deriveStudentLevelDisplay(student.school, classLevels),
      classesEnrolledDisplay:
        activeEnrollments.length > 0
          ? activeEnrollments.map((e) => e.classLabel).join("; ")
          : "—",
      rosterStatus: studentRosterStatus(activeEnrollments),
      siblingNames,
      activeEnrollments,
      withdrawnEnrollments,
    };
  });
}
