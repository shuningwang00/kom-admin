ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "trial_attended_at" date;

ALTER TABLE "trial_leads" ADD COLUMN IF NOT EXISTS "trial_attendance_status" "attendance_status";
ALTER TABLE "trial_leads" ADD COLUMN IF NOT EXISTS "trial_attendance_updated_by" text DEFAULT '' NOT NULL;
