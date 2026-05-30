import {
  boolean,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const allowlistRoleEnum = pgEnum("allowlist_role", ["staff", "tutor"]);

export const weekdayEnum = pgEnum("weekday", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "other",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent_pending",
  "waive",
  "pause",
  "free_trial",
  "makeup_scheduled",
  "makeup_done",
]);

export const classSessionStatusEnum = pgEnum("class_session_status", [
  "scheduled",
  "cancelled",
]);

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    contact: text("contact").notNull().default(""),
    school: text("school").notNull().default(""),
    parentName: text("parent_name").notNull().default(""),
    startDate: date("start_date"),
    notes: text("notes").notNull().default(""),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("students_name_idx").on(t.name)],
);

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    level: text("level").notNull().default(""),
    time: text("time").notNull().default(""),
    tutor: text("tutor").notNull().default(""),
    weekday: weekdayEnum("weekday").notNull().default("other"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("classes_label_weekday_uidx").on(t.label, t.weekday),
    index("classes_tutor_idx").on(t.tutor),
  ],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    startedAt: date("started_at"),
    endedAt: date("ended_at"),
    freeTrial: boolean("free_trial").notNull().default(false),
    registrationFeeDue: boolean("registration_fee_due")
      .notNull()
      .default(false),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("enrollments_student_idx").on(t.studentId),
    index("enrollments_class_idx").on(t.classId),
  ],
);

/** Google sign-in: staff (billing + attendance) or tutor (own classes). Owner is env email only. */
export const siteAllowlist = pgTable(
  "site_allowlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    role: allowlistRoleEnum("role").notNull().default("tutor"),
    displayName: text("display_name").notNull().default(""),
    /** For tutors: match class.tutor (e.g. JUNYANG). Ignored for staff. */
    tutorMatch: text("tutor_match").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("site_allowlist_email_uidx").on(t.email)],
);

/** @deprecated import siteAllowlist */
export const tutorAllowlist = siteAllowlist;

export const classSessions = pgTable(
  "class_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    scheduledDate: date("scheduled_date").notNull(),
    timeLabel: text("time_label").notNull().default(""),
    status: classSessionStatusEnum("status").notNull().default("scheduled"),
    rescheduleNote: text("reschedule_note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("class_sessions_class_date_uidx").on(t.classId, t.scheduledDate),
    index("class_sessions_date_idx").on(t.scheduledDate),
  ],
);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull().default("absent_pending"),
    makeupNote: text("makeup_note").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("attendance_records_session_student_uidx").on(
      t.sessionId,
      t.studentId,
    ),
    index("attendance_records_student_idx").on(t.studentId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorEmail: text("actor_email").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    beforeJson: text("before_json").notNull().default("{}"),
    afterJson: text("after_json").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);

export const importRuns = pgTable("import_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  spreadsheetId: text("spreadsheet_id"),
  statsJson: text("stats_json").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
