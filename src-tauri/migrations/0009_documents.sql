-- Encrypted document metadata. The file bytes live as an AES-256-GCM blob under
-- <appDataDir>/documents/<uuid> (sealed by the per-device vault DEK); only this
-- row's metadata is in SQLite. `file_name` is the blob's uuid.

CREATE TABLE IF NOT EXISTS documents (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id     INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  doc_type       TEXT NOT NULL DEFAULT 'other' CHECK (doc_type IN (
                   'prescription','lab_report','discharge','imaging','insurance','bill','id','other'
                 )),
  title          TEXT NOT NULL,
  provider       TEXT,
  doc_date       TEXT,                 -- 'YYYY-MM-DD'
  file_name      TEXT NOT NULL,        -- vault blob uuid
  mime           TEXT,
  size_bytes     INTEGER,
  extracted_text TEXT,                 -- populated by the import pipeline (Phase 2)
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_profile ON documents(profile_id, doc_date);
