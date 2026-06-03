CREATE TABLE "staff_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_email" text NOT NULL,
	"staff_name" text DEFAULT '' NOT NULL,
	"claim_date" date NOT NULL,
	"amount" text NOT NULL,
	"category" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"receipt_file_id" text,
	"receipt_file_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "staff_claims_email_idx" ON "staff_claims" USING btree ("staff_email");--> statement-breakpoint
CREATE INDEX "staff_claims_status_idx" ON "staff_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "staff_claims_date_idx" ON "staff_claims" USING btree ("claim_date");
