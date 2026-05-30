DO $$ BEGIN
  CREATE TYPE "public"."allowlist_role" AS ENUM('staff', 'tutor');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE IF EXISTS "tutor_allowlist" RENAME TO "site_allowlist";

DO $$ BEGIN
  ALTER TABLE "site_allowlist" ADD COLUMN "role" "allowlist_role" DEFAULT 'tutor' NOT NULL;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

UPDATE "site_allowlist" SET "role" = 'tutor' WHERE "role" IS NULL;

DROP INDEX IF EXISTS "tutor_allowlist_email_uidx";
CREATE UNIQUE INDEX IF NOT EXISTS "site_allowlist_email_uidx"
  ON "site_allowlist" USING btree ("email");
