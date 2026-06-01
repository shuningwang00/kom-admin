-- Allow multiple sessions for the same class on the same date (e.g. rescheduled session
-- at a different time alongside the regular session). Time-overlap is checked in app logic.
DROP INDEX IF EXISTS "class_sessions_class_date_uidx";

CREATE INDEX IF NOT EXISTS "class_sessions_class_date_idx"
  ON "class_sessions" ("class_id", "scheduled_date");
