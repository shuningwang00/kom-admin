CREATE TABLE IF NOT EXISTS "holiday_programmes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "holiday_programme_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "programme_id" uuid NOT NULL,
  "scheduled_date" date NOT NULL,
  "time_label" text DEFAULT '' NOT NULL,
  "tutor_name" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "holiday_programme_sessions_programme_id_holiday_programmes_id_fk"
    FOREIGN KEY ("programme_id") REFERENCES "holiday_programmes"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "holiday_programme_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "programme_id" uuid NOT NULL,
  "student_id" uuid,
  "name" text DEFAULT '' NOT NULL,
  "primary_contact" text DEFAULT '' NOT NULL,
  "primary_contact_type" "contact_type",
  "secondary_contact" text DEFAULT '' NOT NULL,
  "secondary_contact_type" "contact_type",
  "school" text DEFAULT '' NOT NULL,
  "parent_name" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "fee" text DEFAULT '' NOT NULL,
  "fee_paid" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "converted_student_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "holiday_programme_participants_programme_id_fk"
    FOREIGN KEY ("programme_id") REFERENCES "holiday_programmes"("id") ON DELETE CASCADE,
  CONSTRAINT "holiday_programme_participants_student_id_fk"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL,
  CONSTRAINT "holiday_programme_participants_converted_student_id_fk"
    FOREIGN KEY ("converted_student_id") REFERENCES "students"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "holiday_programme_attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "participant_id" uuid NOT NULL,
  "status" "attendance_status" DEFAULT 'absent_pending' NOT NULL,
  "updated_by" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "holiday_programme_attendance_session_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "holiday_programme_sessions"("id") ON DELETE CASCADE,
  CONSTRAINT "holiday_programme_attendance_participant_id_fk"
    FOREIGN KEY ("participant_id") REFERENCES "holiday_programme_participants"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "hps_programme_date_uidx"
  ON "holiday_programme_sessions" ("programme_id", "scheduled_date");

CREATE INDEX IF NOT EXISTS "hps_date_idx"
  ON "holiday_programme_sessions" ("scheduled_date");

CREATE INDEX IF NOT EXISTS "hpp_programme_idx"
  ON "holiday_programme_participants" ("programme_id");

CREATE INDEX IF NOT EXISTS "hpp_student_idx"
  ON "holiday_programme_participants" ("student_id");

CREATE UNIQUE INDEX IF NOT EXISTS "hpa_session_participant_uidx"
  ON "holiday_programme_attendance" ("session_id", "participant_id");

CREATE INDEX IF NOT EXISTS "hpa_participant_idx"
  ON "holiday_programme_attendance" ("participant_id");
