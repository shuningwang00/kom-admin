ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "pause_started_at" date;
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "pause_ended_at" date;
