CREATE TABLE "staff_time_off" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "staff_email" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "reason" text DEFAULT '' NOT NULL,
  "created_by" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "staff_time_off_email_idx" ON "staff_time_off" ("staff_email");
CREATE INDEX "staff_time_off_dates_idx" ON "staff_time_off" ("start_date", "end_date");
