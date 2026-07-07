CREATE TABLE IF NOT EXISTS visitor_labels (
  visitor_id TEXT PRIMARY KEY,
  label TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL
);
