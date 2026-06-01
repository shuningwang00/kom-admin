CREATE TABLE IF NOT EXISTS "site_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL DEFAULT '',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
