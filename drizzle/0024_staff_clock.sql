ALTER TABLE "site_allowlist" ADD COLUMN "hourly_rate" text NOT NULL DEFAULT '';

CREATE TABLE "staff_clock_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "staff_email" text NOT NULL,
  "staff_name" text NOT NULL DEFAULT '',
  "entry_date" date NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "notes" text NOT NULL DEFAULT '',
  "created_by" text NOT NULL DEFAULT '',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "staff_clock_email_idx" ON "staff_clock_entries" ("staff_email");
CREATE INDEX "staff_clock_date_idx" ON "staff_clock_entries" ("entry_date");
