ALTER TABLE pending_credits ADD COLUMN IF NOT EXISTS source_session_id uuid REFERENCES class_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS pc_source_session_idx ON pending_credits(source_session_id);
