CREATE TABLE IF NOT EXISTS "billing_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "label" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "billing_group_id" uuid;

DO $$ BEGIN
  ALTER TABLE "students" ADD CONSTRAINT "students_billing_group_id_billing_groups_id_fk"
    FOREIGN KEY ("billing_group_id") REFERENCES "public"."billing_groups"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "students_billing_group_idx" ON "students" USING btree ("billing_group_id");
