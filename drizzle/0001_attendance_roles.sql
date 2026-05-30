DO $$ BEGIN
  CREATE TYPE "public"."attendance_status" AS ENUM(
    'present', 'absent_pending', 'waive', 'pause', 'free_trial',
    'makeup_scheduled', 'makeup_done'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."class_session_status" AS ENUM('scheduled', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE IF EXISTS "teacher_allowlist" RENAME TO "tutor_allowlist";

CREATE TABLE IF NOT EXISTS "class_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "class_id" uuid NOT NULL,
  "scheduled_date" date NOT NULL,
  "time_label" text DEFAULT '' NOT NULL,
  "status" "class_session_status" DEFAULT 'scheduled' NOT NULL,
  "reschedule_note" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "attendance_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "status" "attendance_status" DEFAULT 'absent_pending' NOT NULL,
  "makeup_note" text DEFAULT '' NOT NULL,
  "updated_by" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_email" text NOT NULL,
  "actor_role" text NOT NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "before_json" text DEFAULT '{}' NOT NULL,
  "after_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "class_sessions"
    ADD CONSTRAINT "class_sessions_class_id_classes_id_fk"
    FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_records"
    ADD CONSTRAINT "attendance_records_session_id_class_sessions_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_records"
    ADD CONSTRAINT "attendance_records_student_id_students_id_fk"
    FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "class_sessions_class_date_uidx"
  ON "class_sessions" USING btree ("class_id", "scheduled_date");
CREATE INDEX IF NOT EXISTS "class_sessions_date_idx"
  ON "class_sessions" USING btree ("scheduled_date");
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_session_student_uidx"
  ON "attendance_records" USING btree ("session_id", "student_id");
CREATE INDEX IF NOT EXISTS "attendance_records_student_idx"
  ON "attendance_records" USING btree ("student_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_idx"
  ON "audit_logs" USING btree ("created_at");
