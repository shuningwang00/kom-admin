CREATE TABLE IF NOT EXISTS "tutor_ooo" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tutor_match" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "reason" text DEFAULT '' NOT NULL,
  "created_by" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "tutor_ooo_tutor_idx" ON "tutor_ooo" ("tutor_match");
CREATE INDEX IF NOT EXISTS "tutor_ooo_dates_idx" ON "tutor_ooo" ("start_date", "end_date");
