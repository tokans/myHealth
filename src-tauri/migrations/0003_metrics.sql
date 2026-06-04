-- Metrics / vitals time-series. One row per reading. Lab results (later) also
-- land here so a single test trends across visits. `source`/`confidence` carry
-- provenance for imported values (native-text / ocr / human).

CREATE TABLE IF NOT EXISTS metrics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,              -- 'weight','bp_systolic','bp_diastolic','glucose_fasting','spo2','heart_rate',...
  value       REAL NOT NULL,
  unit        TEXT,                       -- 'kg','mmHg','mg/dL','%','bpm',...
  taken_at    TEXT NOT NULL,             -- 'YYYY-MM-DD' or full datetime
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','import','device')),
  confidence  REAL,                       -- 0..1 for imported values; null for manual
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_metrics_profile_kind ON metrics(profile_id, kind, taken_at);
