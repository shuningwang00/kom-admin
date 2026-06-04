ALTER TABLE "invoice_line_items" ADD COLUMN "student_id" uuid REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ili_student_idx" ON "invoice_line_items" USING btree ("student_id");--> statement-breakpoint
CREATE TABLE "invoice_students" (
	"invoice_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"billing_month" text NOT NULL,
	CONSTRAINT "invoice_students_student_id_billing_month_pk" PRIMARY KEY("student_id","billing_month")
);
--> statement-breakpoint
ALTER TABLE "invoice_students" ADD CONSTRAINT "invoice_students_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_students" ADD CONSTRAINT "invoice_students_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "is_invoice_idx" ON "invoice_students" USING btree ("invoice_id");--> statement-breakpoint
DROP INDEX IF EXISTS "invoices_student_month_uidx";
