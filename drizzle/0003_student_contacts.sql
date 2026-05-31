DO $$ BEGIN
  CREATE TYPE "public"."contact_type" AS ENUM('mom', 'dad', 'parent', 'student');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "primary_contact" text DEFAULT '' NOT NULL;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "primary_contact_type" "contact_type";
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "secondary_contact" text DEFAULT '' NOT NULL;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "secondary_contact_type" "contact_type";

UPDATE "students"
SET "primary_contact" = "contact"
WHERE ("primary_contact" IS NULL OR "primary_contact" = '')
  AND "contact" IS NOT NULL
  AND "contact" <> '';

ALTER TABLE "students" DROP COLUMN IF EXISTS "contact";
