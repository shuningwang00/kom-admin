CREATE TABLE IF NOT EXISTS "relief_only_tutor" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "relief_only_tutor_name_uidx"
  ON "relief_only_tutor" (lower(trim("name")));
