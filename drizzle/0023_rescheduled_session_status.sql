-- Add rescheduled_away status so the original date slot is preserved as a tombstone
-- when a session is rescheduled, preventing generate-sessions from recreating it.
ALTER TYPE class_session_status ADD VALUE IF NOT EXISTS 'rescheduled_away';
