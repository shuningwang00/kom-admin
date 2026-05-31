DO $$ BEGIN
  CREATE TYPE "public"."trial_lead_status" AS ENUM('active', 'converted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "trial_leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "primary_contact" text DEFAULT '' NOT NULL,
  "primary_contact_type" "contact_type",
  "secondary_contact" text DEFAULT '' NOT NULL,
  "secondary_contact_type" "contact_type",
  "school" text DEFAULT '' NOT NULL,
  "parent_name" text DEFAULT '' NOT NULL,
  "class_id" uuid,
  "trial_date" date,
  "notes" text DEFAULT '' NOT NULL,
  "status" "trial_lead_status" DEFAULT 'active' NOT NULL,
  "converted_student_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "trial_leads" ADD CONSTRAINT "trial_leads_class_id_classes_id_fk"
    FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "trial_leads" ADD CONSTRAINT "trial_leads_converted_student_id_students_id_fk"
    FOREIGN KEY ("converted_student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "trial_leads_status_idx" ON "trial_leads" USING btree ("status");
CREATE INDEX IF NOT EXISTS "trial_leads_name_idx" ON "trial_leads" USING btree ("name");
