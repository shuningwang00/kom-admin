-- Replace the full unique index with a partial one that only applies to active classes.
-- Inactive (deactivated) classes should not block reuse of the same label+weekday.
DROP INDEX IF EXISTS classes_label_weekday_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS classes_label_weekday_uidx ON classes(label, weekday) WHERE is_active = true;
