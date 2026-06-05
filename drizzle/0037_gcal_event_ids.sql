ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS gcal_event_id text;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS gcal_event_id text;
ALTER TABLE admin_roster_shift ADD COLUMN IF NOT EXISTS gcal_event_id text;
