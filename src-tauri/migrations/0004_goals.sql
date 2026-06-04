-- Health goals with deterministic projection (computed in src/domain/goals.ts).

CREATE TABLE IF NOT EXISTS goals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id   INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,            -- 'weight','vital','fitness','habit','preventive'
  title        TEXT NOT NULL,
  metric_kind  TEXT,                     -- links to metrics.kind when measurable
  baseline     REAL,
  target       REAL,
  unit         TEXT,
  direction    TEXT CHECK (direction IN ('decrease','increase','maintain')) DEFAULT 'decrease',
  target_date  TEXT,                     -- 'YYYY-MM-DD'
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','achieved','archived')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_goals_profile ON goals(profile_id, status);
