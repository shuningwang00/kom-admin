ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES class_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ili_session_idx ON invoice_line_items(session_id);
