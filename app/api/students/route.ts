import {
  assertCanManageStudents,
  assertCanReadRoster,
} from "@/lib/auth/access";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assignStudentBillingGroup } from "@/lib/billing-groups/resolve";
import { getDb } from "@/lib/db/index";
import { billingGroups, classes, enrollments, students } from "@/lib/db/schema";
import { contactFieldsForCreate } from "@/lib/students/contact-fields";
import { buildStudentRoster } from "@/lib/students/roster";
import { asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await assertCanReadRoster();
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("archived") === "1";
    const withdrawnOnly = searchParams.get("withdrawn") === "1";
    const db = getDb();

    const enrollmentRows = await db
      .select({ enrollment: enrollments, class: classes })
      .from(enrollments)
      .innerJoin(classes, eq(enrollments.classId, classes.id))
      .where(
        withdrawnOnly ? isNotNull(enrollments.endedAt) : isNull(enrollments.endedAt),
      );

    if (withdrawnOnly) {
      const studentIds = [
        ...new Set(enrollmentRows.map((r) => r.enrollment.studentId)),
      ];
      if (studentIds.length === 0) {
        return jsonOk({ students: [] });
      }

      const rows = await db
        .select({
          student: students,
          billingGroupLabel: billingGroups.label,
        })
        .from(students)
        .leftJoin(
          billingGroups,
          eq(students.billingGroupId, billingGroups.id),
        )
        .where(inArray(students.id, studentIds))
        .orderBy(asc(students.name));

      const studentsOut = buildStudentRoster(
        rows.map(({ student, billingGroupLabel }) => ({
          student,
          billingGroupLabel: billingGroupLabel ?? null,
        })),
        enrollmentRows,
      );
      return jsonOk({ students: studentsOut });
    }

    const rows = await db
      .select({
        student: students,
        billingGroupLabel: billingGroups.label,
      })
      .from(students)
      .leftJoin(billingGroups, eq(students.billingGroupId, billingGroups.id))
      .where(includeArchived ? undefined : isNull(students.archivedAt))
      .orderBy(asc(students.name));

    const studentsOut = buildStudentRoster(
      rows.map(({ student, billingGroupLabel }) => ({
        student,
        billingGroupLabel: billingGroupLabel ?? null,
      })),
      enrollmentRows,
    );
    return jsonOk({ students: studentsOut });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 500;
    return jsonError(message, status);
  }
}

export async function POST(request: Request) {
  try {
    await assertCanManageStudents();
    const body = (await request.json()) as Record<string, unknown>;

    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Name is required.");

    const db = getDb();
    const [created] = await db
      .insert(students)
      .values({
        name,
        ...contactFieldsForCreate(body),
        school: String(body.school ?? "").trim(),
        parentName: String(body.parentName ?? "").trim(),
        startDate:
          body.startDate != null && String(body.startDate).trim()
            ? String(body.startDate).trim()
            : null,
        notes: String(body.notes ?? "").trim(),
      })
      .returning();

    const classId = String(body.classId ?? "").trim();
    if (classId) {
      const { enrollments } = await import("@/lib/db/schema");
      const startedAt =
        body.startDate != null && String(body.startDate).trim()
          ? String(body.startDate).trim()
          : null;
      await db.insert(enrollments).values({
        studentId: created.id,
        classId,
        registrationFeeDue: Boolean(body.registrationFeeDue),
        startedAt,
      });
    }

    const siblingIds = Array.isArray(body.siblingStudentIds)
      ? (body.siblingStudentIds as string[])
      : undefined;
    const billingGroupId =
      body.billingGroupId != null && String(body.billingGroupId).trim()
        ? String(body.billingGroupId).trim()
        : undefined;

    if (billingGroupId !== undefined || (siblingIds && siblingIds.length > 0)) {
      await assignStudentBillingGroup(db, created.id, {
        billingGroupId: billingGroupId ?? undefined,
        siblingStudentIds: siblingIds,
        label:
          body.billingGroupLabel != null
            ? String(body.billingGroupLabel)
            : undefined,
      });
      const [refreshed] = await db
        .select()
        .from(students)
        .where(eq(students.id, created.id));
      return jsonOk({ student: refreshed ?? created }, 201);
    }

    return jsonOk({ student: created }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("cannot edit") || message.includes("Roster")
          ? 403
          : message.includes("DATABASE_URL")
            ? 503
            : 500;
    return jsonError(message, status);
  }
}
