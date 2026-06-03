CREATE TABLE "calendar_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "event_date" date NOT NULL,
  "start_time" text NOT NULL DEFAULT '',
  "end_time" text NOT NULL DEFAULT '',
  "notes" text NOT NULL DEFAULT '',
  "created_by" text NOT NULL DEFAULT '',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "calendar_events_date_idx" ON "calendar_events" ("event_date");
