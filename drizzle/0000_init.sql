CREATE TYPE "public"."weekday" AS ENUM(
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'other'
);

CREATE TABLE "students" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "contact" text DEFAULT '' NOT NULL,
  "school" text DEFAULT '' NOT NULL,
  "parent_name" text DEFAULT '' NOT NULL,
  "start_date" date,
  "notes" text DEFAULT '' NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "classes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "label" text NOT NULL,
  "level" text DEFAULT '' NOT NULL,
  "time" text DEFAULT '' NOT NULL,
  "tutor" text DEFAULT '' NOT NULL,
  "weekday" "weekday" DEFAULT 'other' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "enrollments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "class_id" uuid NOT NULL,
  "started_at" date,
  "ended_at" date,
  "free_trial" boolean DEFAULT false NOT NULL,
  "registration_fee_due" boolean DEFAULT false NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "teacher_allowlist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "display_name" text DEFAULT '' NOT NULL,
  "tutor_match" text DEFAULT '' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "import_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" text NOT NULL,
  "spreadsheet_id" text,
  "stats_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_student_id_students_id_fk"
  FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_class_id_classes_id_fk"
  FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "students_name_idx" ON "students" USING btree ("name");
CREATE UNIQUE INDEX "classes_label_weekday_uidx" ON "classes" USING btree ("label", "weekday");
CREATE INDEX "classes_tutor_idx" ON "classes" USING btree ("tutor");
CREATE INDEX "enrollments_student_idx" ON "enrollments" USING btree ("student_id");
CREATE INDEX "enrollments_class_idx" ON "enrollments" USING btree ("class_id");
CREATE UNIQUE INDEX "teacher_allowlist_email_uidx" ON "teacher_allowlist" USING btree ("email");
