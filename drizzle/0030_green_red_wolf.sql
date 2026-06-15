ALTER TYPE "public"."invoice_status" ADD VALUE IF NOT EXISTS 'draft' BEFORE 'sent';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_students" (
	"invoice_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"billing_month" text NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS "invoices_student_month_uidx";--> statement-breakpoint
DROP INDEX IF EXISTS "classes_label_weekday_uidx";--> statement-breakpoint
ALTER TABLE "admin_roster_shift" ADD COLUMN IF NOT EXISTS "gcal_event_id" text;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "gcal_event_id" text;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN IF NOT EXISTS "original_date" date;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN IF NOT EXISTS "gcal_event_id" text;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "subject" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "classroom" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "holiday_programme_sessions" ADD COLUMN IF NOT EXISTS "gcal_event_id" text;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN IF NOT EXISTS "session_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN IF NOT EXISTS "student_id" uuid;--> statement-breakpoint
ALTER TABLE "pending_credits" ADD COLUMN IF NOT EXISTS "source_session_id" uuid;--> statement-breakpoint
ALTER TABLE "trial_leads" ADD COLUMN IF NOT EXISTS "first_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_students" ADD CONSTRAINT "invoice_students_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_students" ADD CONSTRAINT "invoice_students_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "is_invoice_idx" ON "invoice_students" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "is_student_month_uidx" ON "invoice_students" USING btree ("student_id","billing_month");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pending_credits" ADD CONSTRAINT "pending_credits_source_session_id_class_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."class_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ili_session_idx" ON "invoice_line_items" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ili_student_idx" ON "invoice_line_items" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pc_source_session_idx" ON "pending_credits" USING btree ("source_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "classes_label_weekday_uidx" ON "classes" USING btree ("label","weekday") WHERE is_active = true;
