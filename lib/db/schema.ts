import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const allowlistRoleEnum = pgEnum("allowlist_role", [
  "staff",
  "tutor",
  "staff_tutor",
  "relief_tutor",
]);

export const contactTypeEnum = pgEnum("contact_type", [
  "mom",
  "dad",
  "parent",
  "student",
]);

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
  "absent_notified",
  "waive",
  "pause",
  "free_trial",
  "makeup_scheduled",
  "makeup_done",
  "makeup_absent",
]);

export const classSessionStatusEnum = pgEnum("class_session_status", [
  "scheduled",
  "cancelled",
  "rescheduled_away",
]);

export const trialLeadStatusEnum = pgEnum("trial_lead_status", [
  "active",
  "converted",
  "declined",
]);

export const billingGroups = pgTable("billing_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingGroupId: uuid("billing_group_id").references(() => billingGroups.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    primaryContact: text("primary_contact").notNull().default(""),
    primaryContactType: contactTypeEnum("primary_contact_type"),
    secondaryContact: text("secondary_contact").notNull().default(""),
    secondaryContactType: contactTypeEnum("secondary_contact_type"),
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
  (t) => [
    index("students_name_idx").on(t.name),
    index("students_billing_group_idx").on(t.billingGroupId),
    index("students_archived_idx").on(t.archivedAt),
  ],
);

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    subject: text("subject").notNull().default(""),
    level: text("level").notNull().default(""),
    time: text("time").notNull().default(""),
    tutor: text("tutor").notNull().default(""),
    weekday: weekdayEnum("weekday").notNull().default("other"),
    isActive: boolean("is_active").notNull().default(true),
    isFull: boolean("is_full").notNull().default(false),
    feePerLesson: text("fee_per_lesson").notNull().default(""),
    description: text("description").notNull().default(""),
    classroom: text("classroom").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("classes_label_weekday_uidx").on(t.label, t.weekday).where(sql`is_active = true`),
    index("classes_tutor_idx").on(t.tutor),
  ],
);

/** Prospective free-trial students — not in main roster until converted. */
export const trialLeads = pgTable(
  "trial_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    firstName: text("first_name").notNull().default(""),
    primaryContact: text("primary_contact").notNull().default(""),
    primaryContactType: contactTypeEnum("primary_contact_type"),
    secondaryContact: text("secondary_contact").notNull().default(""),
    secondaryContactType: contactTypeEnum("secondary_contact_type"),
    school: text("school").notNull().default(""),
    parentName: text("parent_name").notNull().default(""),
    classId: uuid("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    trialDate: date("trial_date"),
    /** Set when staff saves attendance on the trial lesson (before convert). */
    trialAttendanceStatus: attendanceStatusEnum("trial_attendance_status"),
    trialAttendanceUpdatedBy: text("trial_attendance_updated_by")
      .notNull()
      .default(""),
    notes: text("notes").notNull().default(""),
    status: trialLeadStatusEnum("status").notNull().default("active"),
    convertedStudentId: uuid("converted_student_id").references(
      () => students.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("trial_leads_status_idx").on(t.status),
    index("trial_leads_name_idx").on(t.name),
    index("trial_leads_class_idx").on(t.classId),
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
    /** Free trial lesson date (may be before registration / class start). */
    trialAttendedAt: date("trial_attended_at"),
    endedAt: date("ended_at"),
    pauseStartedAt: date("pause_started_at"),
    pauseEndedAt: date("pause_ended_at"),
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
    index("enrollments_ended_idx").on(t.endedAt),
  ],
);

/** Google sign-in: staff (billing + attendance) or tutor (own classes). Owner is env email only. */
export const siteAllowlist = pgTable(
  "site_allowlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    role: allowlistRoleEnum("role").notNull().default("tutor"),
    /** Short name shown in app (roster, calendar, attendance). For tutors this is the schedule name (tutorMatch); set this for staff. */
    displayName: text("display_name").notNull().default(""),
    /** Legal / full name — for payroll, profile, formal use. */
    fullName: text("full_name").notNull().default(""),
    /** For tutors: match class.tutor (e.g. JUNYANG). Ignored for staff. */
    tutorMatch: text("tutor_match").notNull().default(""),
    /** JSON blob of per-user permission overrides (flat key:boolean pairs). Merges over role defaults. */
    permissionsJson: text("permissions_json").notNull().default(""),
    /** Staff (or staff+tutor) who appear in relief / makeup tutor dropdowns. */
    alsoReliefTutor: boolean("also_relief_tutor").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    /** Hourly admin rate for payroll, e.g. "20.00". Empty = not set. */
    hourlyRate: text("hourly_rate").notNull().default(""),
    /** Telegram handle without @, e.g. "ziningswork". Used for bot notifications. */
    telegramHandle: text("telegram_handle").notNull().default(""),
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
    /** Original scheduled date before the first reschedule; null if never rescheduled. */
    originalDate: date("original_date"),
    /** When set, this tutor covers the session instead of class.tutor */
    reliefTutor: text("relief_tutor").notNull().default(""),
    gcalEventId: text("gcal_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("class_sessions_class_date_idx").on(t.classId, t.scheduledDate),
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
    index("attendance_records_status_idx").on(t.status),
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

/** When a staff member is available for admin duty (by calendar date). */
export const staffAvailability = pgTable(
  "staff_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffEmail: text("staff_email").notNull(),
    availDate: date("avail_date").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    slotLabel: text("slot_label").notNull().default(""),
    note: text("note").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("staff_avail_email_date_idx").on(t.staffEmail, t.availDate),
    uniqueIndex("staff_avail_email_date_start_uidx").on(
      t.staffEmail,
      t.availDate,
      t.startTime,
    ),
  ],
);

/** Staff long leave — clears admin availability for those dates. */
export const staffTimeOff = pgTable(
  "staff_time_off",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffEmail: text("staff_email").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    reason: text("reason").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("staff_time_off_email_idx").on(t.staffEmail),
    index("staff_time_off_dates_idx").on(t.startDate, t.endDate),
  ],
);

/** Published admin-on-duty shifts (owner-built from availability). */
export const adminRosterShift = pgTable(
  "admin_roster_shift",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shiftDate: date("shift_date").notNull(),
    staffEmail: text("staff_email").notNull(),
    staffName: text("staff_name").notNull().default(""),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    published: boolean("published").notNull().default(false),
    createdBy: text("created_by").notNull().default(""),
    gcalEventId: text("gcal_event_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("admin_roster_date_idx").on(t.shiftDate),
    index("admin_roster_staff_idx").on(t.staffEmail),
  ],
);

export const tutorOoo = pgTable(
  "tutor_ooo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Matches class.tutor (e.g. "JUNYANG"). Case-insensitive comparison at query time. */
    tutorMatch: text("tutor_match").notNull(),
    startDate: date("start_date").notNull(),
    /** Inclusive last OOO day. */
    endDate: date("end_date").notNull(),
    reason: text("reason").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tutor_ooo_tutor_idx").on(t.tutorMatch),
    index("tutor_ooo_dates_idx").on(t.startDate, t.endDate),
  ],
);

/** Tutor names for relief dropdowns — not required on the class schedule sheet. */
export const reliefOnlyTutor = pgTable(
  "relief_only_tutor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("relief_only_tutor_name_idx").on(t.name)],
);

export const staffClockEntries = pgTable(
  "staff_clock_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffEmail: text("staff_email").notNull(),
    staffName: text("staff_name").notNull().default(""),
    entryDate: date("entry_date").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("staff_clock_email_idx").on(t.staffEmail),
    index("staff_clock_date_idx").on(t.entryDate),
  ],
);

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const importRuns = pgTable("import_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  spreadsheetId: text("spreadsheet_id"),
  statsJson: text("stats_json").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const holidayProgrammes = pgTable("holiday_programmes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const holidayProgrammeSessions = pgTable(
  "holiday_programme_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programmeId: uuid("programme_id")
      .notNull()
      .references(() => holidayProgrammes.id, { onDelete: "cascade" }),
    scheduledDate: date("scheduled_date").notNull(),
    timeLabel: text("time_label").notNull().default(""),
    tutorName: text("tutor_name").notNull().default(""),
    notes: text("notes").notNull().default(""),
    gcalEventId: text("gcal_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("hps_programme_date_uidx").on(t.programmeId, t.scheduledDate),
    index("hps_date_idx").on(t.scheduledDate),
  ],
);

export const holidayProgrammeParticipants = pgTable(
  "holiday_programme_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programmeId: uuid("programme_id")
      .notNull()
      .references(() => holidayProgrammes.id, { onDelete: "cascade" }),
    /** Set when participant is an existing student (not a new lead). */
    studentId: uuid("student_id").references(() => students.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull().default(""),
    primaryContact: text("primary_contact").notNull().default(""),
    primaryContactType: contactTypeEnum("primary_contact_type"),
    secondaryContact: text("secondary_contact").notNull().default(""),
    secondaryContactType: contactTypeEnum("secondary_contact_type"),
    level: text("level").notNull().default(""),
    school: text("school").notNull().default(""),
    parentName: text("parent_name").notNull().default(""),
    notes: text("notes").notNull().default(""),
    /** Manually entered fee string, empty = free. */
    fee: text("fee").notNull().default(""),
    feePaid: boolean("fee_paid").notNull().default(false),
    /** "active" or "converted". Only relevant for new leads (studentId is null). */
    status: text("status").notNull().default("active"),
    convertedStudentId: uuid("converted_student_id").references(
      () => students.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("hpp_programme_idx").on(t.programmeId),
    index("hpp_student_idx").on(t.studentId),
  ],
);

export const holidayProgrammeAttendance = pgTable(
  "holiday_programme_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => holidayProgrammeSessions.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => holidayProgrammeParticipants.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull().default("absent_pending"),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("hpa_session_participant_uidx").on(t.sessionId, t.participantId),
    index("hpa_participant_idx").on(t.participantId),
  ],
);

export const staffClaims = pgTable(
  "staff_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffEmail: text("staff_email").notNull(),
    staffName: text("staff_name").notNull().default(""),
    claimDate: date("claim_date").notNull(),
    amount: text("amount").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    receiptFileId: text("receipt_file_id"),
    receiptFileName: text("receipt_file_name"),
    status: text("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("staff_claims_email_idx").on(t.staffEmail),
    index("staff_claims_status_idx").on(t.status),
    index("staff_claims_date_idx").on(t.claimDate),
  ],
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    eventDate: date("event_date").notNull(),
    startTime: text("start_time").notNull().default(""),
    endTime: text("end_time").notNull().default(""),
    notes: text("notes").notNull().default(""),
    gcalEventId: text("gcal_event_id"),
    createdBy: text("created_by").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("calendar_events_date_idx").on(t.eventDate),
  ],
);

// ─── Billing ──────────────────────────────────────────────────────────────────

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "partial",
  "paid",
  "void",
]);

export const lineItemTypeEnum = pgEnum("line_item_type", [
  "tuition",
  "registration_fee",
  "balance_forward",
  "credit",
  "discount",
]);

/** Per-student rate override, optionally scoped to a class and/or date range. */
export const studentRateOverrides = pgTable(
  "student_rate_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** Null = applies to all classes for this student. */
    classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }),
    /** e.g. "85.00" */
    ratePerLesson: text("rate_per_lesson").notNull(),
    /** Inclusive start — null = always. */
    validFrom: date("valid_from"),
    /** Inclusive end — null = no end. */
    validTo: date("valid_to"),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sro_student_idx").on(t.studentId),
    index("sro_class_idx").on(t.classId),
  ],
);

/** One invoice per student per billing month. */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    /** "YYYY-MM" */
    billingMonth: text("billing_month").notNull(),
    /** e.g. "KOM-2026-06-0001" */
    invoiceNumber: text("invoice_number").notNull(),
    status: invoiceStatusEnum("status").notNull().default("sent"),
    /** Sum of all tuition + registration fee line items. */
    subtotal: text("subtotal").notNull().default("0.00"),
    /** Manual discount — subtracted from subtotal. */
    discountAmount: text("discount_amount").notNull().default("0.00"),
    /** Unpaid amount carried forward from previous invoice (positive = owed). */
    balanceForward: text("balance_forward").notNull().default("0.00"),
    /** Credit applied from pending_credits (reduces total due). */
    creditApplied: text("credit_applied").notNull().default("0.00"),
    /** subtotal − discount + balanceForward − creditApplied */
    totalDue: text("total_due").notNull().default("0.00"),
    /** Sum of recorded payments. */
    totalPaid: text("total_paid").notNull().default("0.00"),
    remarks: text("remarks").notNull().default(""),
    pdfFileId: text("pdf_file_id"),
    pdfFileName: text("pdf_file_name"),
    receiptFileId: text("receipt_file_id"),
    receiptFileName: text("receipt_file_name"),
    createdBy: text("created_by").notNull().default(""),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: text("voided_by").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invoices_student_idx").on(t.studentId),
    index("invoices_month_idx").on(t.billingMonth),
    index("invoices_status_idx").on(t.status),
    uniqueIndex("invoices_number_uidx").on(t.invoiceNumber),
  ],
);

export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    type: lineItemTypeEnum("type").notNull(),
    /** Set for tuition items — links back to the attendance record. */
    attendanceRecordId: uuid("attendance_record_id").references(
      () => attendanceRecords.id,
      { onDelete: "set null" },
    ),
    /** Stable FK to the session row — survives reschedules; used to detect double-billing. */
    sessionId: uuid("session_id").references(() => classSessions.id, { onDelete: "set null" }),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
    /** Denormalised class label (e.g. "Sec 2 Maths") for PDF grouping. */
    classLabel: text("class_label").notNull().default(""),
    sessionDate: date("session_date"),
    /** Human-readable line, e.g. "Balance forward" or "Sibling discount". */
    description: text("description").notNull().default(""),
    /** e.g. "2026-05-03 (Pending M/U)" — shown as sub-line on PDF. */
    detail: text("detail").notNull().default(""),
    /** Positive for charges, negative for credits/discounts. */
    amount: text("amount").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ili_invoice_idx").on(t.invoiceId),
    index("ili_attendance_idx").on(t.attendanceRecordId),
    index("ili_session_idx").on(t.sessionId),
    index("ili_student_idx").on(t.studentId),
  ],
);

/** Payment events against an invoice. */
export const invoicePayments = pgTable(
  "invoice_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amount: text("amount").notNull(),
    paymentDate: date("payment_date").notNull(),
    notes: text("notes").notNull().default(""),
    recordedBy: text("recorded_by").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ip_invoice_idx").on(t.invoiceId)],
);

/** Junction table: all students covered by a given invoice (enforces 1 invoice per student per month). */
export const invoiceStudents = pgTable(
  "invoice_students",
  {
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    billingMonth: text("billing_month").notNull(),
  },
  (t) => [
    index("is_invoice_idx").on(t.invoiceId),
    // One invoice per student per month — primary uniqueness constraint
    uniqueIndex("is_student_month_uidx").on(t.studentId, t.billingMonth),
  ],
);

/** Unapplied credits — created on overpayment or when a waived session was on a paid invoice. */
export const pendingCredits = pgTable(
  "pending_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    amount: text("amount").notNull(),
    reason: text("reason").notNull().default(""),
    sourceInvoiceId: uuid("source_invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    /** Set when this credit was created by cancelling or waiving a specific session. Used to reverse the credit if the session is later restored. */
    sourceSessionId: uuid("source_session_id").references(() => classSessions.id, {
      onDelete: "set null",
    }),
    appliedToInvoiceId: uuid("applied_to_invoice_id").references(
      () => invoices.id,
      { onDelete: "set null" },
    ),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pc_student_idx").on(t.studentId),
    index("pc_applied_idx").on(t.appliedAt),
    index("pc_source_session_idx").on(t.sourceSessionId),
  ],
);
