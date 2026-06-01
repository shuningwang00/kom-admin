import { attachExpectedAttendance } from "@/lib/attendance/expected-counts";
import { mergeConsolidatedSessionListRows } from "@/lib/attendance/merge-consolidated-sessions";
import { formatCalendarDate } from "@/lib/dates/calendar";
import type { SessionUser } from "@/lib/auth/config";
import { getTutorMatch, tutorCanAccessClass } from "@/lib/auth/user";
import { getDb } from "@/lib/db/index";
import { isEnrollmentActiveOnDate } from "@/lib/enrollments/eligibility";
import { classSessions, classes, enrollments, students, trialLeads } from "@/lib/db/schema";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte } from "drizzle-orm";

type Db = ReturnType<typeof getDb>;

async function activeEnrollmentClassIds(
  db: Db,
  sessionDate?: string,
): Promise<Set<string>> {
  const [enrollmentRows, trialLeadRows] = await Promise.all([
    db
      .select({
        classId: enrollments.classId,
        enrollmentStartedAt: enrollments.startedAt,
        trialAttendedAt: enrollments.trialAttendedAt,
        enrollmentEndedAt: enrollments.endedAt,
        pauseStartedAt: enrollments.pauseStartedAt,
        pauseEndedAt: enrollments.pauseEndedAt,
        studentStartDate: students.startDate,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(isNull(students.archivedAt)),
    sessionDate
      ? db
          .select({ classId: trialLeads.classId })
          .from(trialLeads)
          .where(
            and(
              eq(trialLeads.status, "active"),
              eq(trialLeads.trialDate, sessionDate),
              isNotNull(trialLeads.classId),
            ),
          )
      : Promise.resolve([]),
  ]);

  const classIds = new Set<string>();
  for (const row of enrollmentRows) {
    if (
      sessionDate &&
      !isEnrollmentActiveOnDate({
        sessionDate,
        enrollmentStartedAt: row.enrollmentStartedAt,
        studentStartDate: row.studentStartDate,
        enrollmentEndedAt: row.enrollmentEndedAt,
        pauseStartedAt: row.pauseStartedAt,
        pauseEndedAt: row.pauseEndedAt,
        trialAttendedAt: row.trialAttendedAt,
      })
    ) {
      continue;
    }
    classIds.add(row.classId);
  }
  for (const row of trialLeadRows) {
    if (row.classId) classIds.add(row.classId);
  }
  return classIds;
}

function withEnrolledStudentsOnly<T extends { class: { id: string } }>(
  rows: T[],
  enrolledClassIds: Set<string>,
): T[] {
  return rows.filter((r) => enrolledClassIds.has(r.class.id));
}

export async function listSessionsForDate(date: string, user: SessionUser) {
  const db = getDb();
  const enrolledClassIds = await activeEnrollmentClassIds(db, date);
  const rows = withEnrolledStudentsOnly(
    await db
      .select({ session: classSessions, class: classes })
      .from(classSessions)
      .innerJoin(classes, eq(classSessions.classId, classes.id))
      .where(
        and(
          eq(classSessions.scheduledDate, date),
          inArray(classSessions.status, ["scheduled", "cancelled"]),
          eq(classes.isActive, true),
        ),
      )
      .orderBy(asc(classes.time), asc(classes.label)),
    enrolledClassIds,
  );

  let visible = rows;
  if (user.role !== "owner" && user.role !== "staff") {
    const match = await getTutorMatch(user); // uses cached tutorMatch — no DB hit
    visible = rows.filter(
      (r) =>
        tutorCanAccessClass(r.class.tutor, match) ||
        tutorCanAccessClass(r.session.reliefTutor, match),
    );
  }

  const withExpected = await attachExpectedAttendance(visible);
  return await mergeConsolidatedSessionListRows(withExpected);
}

export async function listTutorSessionsOverview(user: SessionUser) {
  const db = getDb();
  const enrolledClassIds = await activeEnrollmentClassIds(db);
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 14);
  const to = new Date(today);
  to.setDate(to.getDate() + 60);

  const fromStr = formatCalendarDate(
    from.getFullYear(),
    from.getMonth() + 1,
    from.getDate(),
  );
  const toStr = formatCalendarDate(
    to.getFullYear(),
    to.getMonth() + 1,
    to.getDate(),
  );

  const rows = await db
    .select({ session: classSessions, class: classes })
    .from(classSessions)
    .innerJoin(classes, eq(classSessions.classId, classes.id))
    .where(
      and(
        gte(classSessions.scheduledDate, fromStr),
        lte(classSessions.scheduledDate, toStr),
        eq(classSessions.status, "scheduled"),
        eq(classes.isActive, true),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate), asc(classes.time));

  const match =
    user.role === "owner" || user.role === "staff"
      ? ""
      : await getTutorMatch(user); // uses cached tutorMatch — no DB hit
  const roleFiltered =
    user.role === "owner" || user.role === "staff"
      ? rows
      : rows.filter(
          (r) =>
            tutorCanAccessClass(r.class.tutor, match) ||
            tutorCanAccessClass(r.session.reliefTutor, match),
        );

  const filtered = withEnrolledStudentsOnly(roleFiltered, enrolledClassIds);

  const withExpected = await attachExpectedAttendance(filtered);

  const byClass = new Map<
    string,
    {
      class: (typeof withExpected)[0]["class"];
      sessions: Array<
        (typeof withExpected)[0]["session"] & {
          expected: (typeof withExpected)[0]["expected"];
          expectedLabel: (typeof withExpected)[0]["expectedLabel"];
          attendanceMarked: boolean;
          attendanceMarkLabel: string;
        }
      >;
    }
  >();

  for (const row of withExpected) {
    const key = row.class.id;
    if (!byClass.has(key)) {
      byClass.set(key, { class: row.class, sessions: [] });
    }
    byClass.get(key)!.sessions.push({
      ...row.session,
      expected: row.expected,
      expectedLabel: row.expectedLabel,
      attendanceMarked: row.attendanceMarked,
      attendanceMarkLabel: row.attendanceMarkLabel,
    });
  }

  return [...byClass.values()];
}

export async function listSessionsForMonth(yearMonth: string, user: SessionUser) {
  const [y, m] = yearMonth.split("-").map(Number);
  const startDate = formatCalendarDate(y, m, 1);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = formatCalendarDate(y, m, lastDay);

  const db = getDb();
  const enrolledClassIds = await activeEnrollmentClassIds(db);
  const rows = withEnrolledStudentsOnly(
    await db
      .select({ session: classSessions, class: classes })
      .from(classSessions)
      .innerJoin(classes, eq(classSessions.classId, classes.id))
      .where(
        and(
          gte(classSessions.scheduledDate, startDate),
          lte(classSessions.scheduledDate, endDate),
          inArray(classSessions.status, ["scheduled", "cancelled"]),
          eq(classes.isActive, true),
        ),
      )
      .orderBy(asc(classSessions.scheduledDate), asc(classes.time), asc(classes.label)),
    enrolledClassIds,
  );

  let visible = rows;
  if (user.role !== "owner" && user.role !== "staff") {
    const match = await getTutorMatch(user);
    visible = rows.filter(
      (r) =>
        tutorCanAccessClass(r.class.tutor, match) ||
        tutorCanAccessClass(r.session.reliefTutor, match),
    );
  }

  const withExpected = await attachExpectedAttendance(visible);
  return await mergeConsolidatedSessionListRows(withExpected);
}

/** Past sessions (before `beforeDate`) where attendance still needs marking. */
export async function listUnmarkedPastSessions(
  user: SessionUser,
  beforeDate: string,
) {
  const db = getDb();
  const enrolledClassIds = await activeEnrollmentClassIds(db);

  const rows = withEnrolledStudentsOnly(
    await db
      .select({ session: classSessions, class: classes })
      .from(classSessions)
      .innerJoin(classes, eq(classSessions.classId, classes.id))
      .where(
        and(
          lt(classSessions.scheduledDate, beforeDate),
          inArray(classSessions.status, ["scheduled", "cancelled"]),
          eq(classes.isActive, true),
        ),
      )
      .orderBy(
        desc(classSessions.scheduledDate),
        asc(classes.time),
        asc(classes.label),
      ),
    enrolledClassIds,
  );

  let visible = rows;
  if (user.role !== "owner" && user.role !== "staff") {
    const match = await getTutorMatch(user); // uses cached tutorMatch — no DB hit
    visible = rows.filter(
      (r) =>
        tutorCanAccessClass(r.class.tutor, match) ||
        tutorCanAccessClass(r.session.reliefTutor, match),
    );
  }

  const withExpected = await attachExpectedAttendance(visible);

  const merged = await mergeConsolidatedSessionListRows(withExpected);

  return merged.filter(
    (row) =>
      row.attendanceMarkLabel !== "—" && !row.attendanceMarked,
  );
}
