CREATE TYPE "public"."invoice_status" AS ENUM('sent', 'partial', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."line_item_type" AS ENUM('tuition', 'registration_fee', 'balance_forward', 'credit', 'discount');--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"type" "line_item_type" NOT NULL,
	"attendance_record_id" uuid,
	"class_id" uuid,
	"class_label" text DEFAULT '' NOT NULL,
	"session_date" date,
	"description" text DEFAULT '' NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"amount" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" text NOT NULL,
	"payment_date" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"recorded_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"billing_month" text NOT NULL,
	"invoice_number" text NOT NULL,
	"status" "invoice_status" DEFAULT 'sent' NOT NULL,
	"subtotal" text DEFAULT '0.00' NOT NULL,
	"discount_amount" text DEFAULT '0.00' NOT NULL,
	"balance_forward" text DEFAULT '0.00' NOT NULL,
	"credit_applied" text DEFAULT '0.00' NOT NULL,
	"total_due" text DEFAULT '0.00' NOT NULL,
	"total_paid" text DEFAULT '0.00' NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"pdf_file_id" text,
	"pdf_file_name" text,
	"receipt_file_id" text,
	"receipt_file_name" text,
	"created_by" text DEFAULT '' NOT NULL,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"voided_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"amount" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"source_invoice_id" uuid,
	"applied_to_invoice_id" uuid,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_rate_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid,
	"rate_per_lesson" text NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "is_full" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "fee_per_lesson" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_attendance_record_id_attendance_records_id_fk" FOREIGN KEY ("attendance_record_id") REFERENCES "public"."attendance_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_credits" ADD CONSTRAINT "pending_credits_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_credits" ADD CONSTRAINT "pending_credits_source_invoice_id_invoices_id_fk" FOREIGN KEY ("source_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_credits" ADD CONSTRAINT "pending_credits_applied_to_invoice_id_invoices_id_fk" FOREIGN KEY ("applied_to_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_rate_overrides" ADD CONSTRAINT "student_rate_overrides_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_rate_overrides" ADD CONSTRAINT "student_rate_overrides_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ili_invoice_idx" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "ili_attendance_idx" ON "invoice_line_items" USING btree ("attendance_record_id");--> statement-breakpoint
CREATE INDEX "ip_invoice_idx" ON "invoice_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_student_month_uidx" ON "invoices" USING btree ("student_id","billing_month");--> statement-breakpoint
CREATE INDEX "invoices_student_idx" ON "invoices" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "invoices_month_idx" ON "invoices" USING btree ("billing_month");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_uidx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "pc_student_idx" ON "pending_credits" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "pc_applied_idx" ON "pending_credits" USING btree ("applied_at");--> statement-breakpoint
CREATE INDEX "sro_student_idx" ON "student_rate_overrides" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "sro_class_idx" ON "student_rate_overrides" USING btree ("class_id");