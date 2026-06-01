CREATE TABLE "staff_availability" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "staff_email" text NOT NULL,
  "avail_date" date NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "slot_label" text DEFAULT '' NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "staff_avail_email_date_idx" ON "staff_availability" ("staff_email", "avail_date");
CREATE UNIQUE INDEX "staff_avail_email_date_start_uidx" ON "staff_availability" ("staff_email", "avail_date", "start_time");

CREATE TABLE "admin_roster_shift" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "shift_date" date NOT NULL,
  "staff_email" text NOT NULL,
  "staff_name" text DEFAULT '' NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "published" boolean DEFAULT false NOT NULL,
  "created_by" text DEFAULT '' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "admin_roster_date_idx" ON "admin_roster_shift" ("shift_date");
CREATE INDEX "admin_roster_staff_idx" ON "admin_roster_shift" ("staff_email");
