-- Medications per profile. Active meds generate daily "take" reminders via the
-- derived-reminder sweep, and feed the medical ICE card's "current medications".

CREATE TABLE IF NOT EXISTS medications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  drug        TEXT NOT NULL,
  strength    TEXT,                       -- e.g. '500 mg'
  form        TEXT,                       -- 'tablet','capsule','syrup','injection',...
  schedule    TEXT,                       -- 'OD','BD','TDS','QID','PRN','custom'
  times       TEXT,                       -- optional CSV of 'HH:MM'
  prescriber  TEXT,
  start_date  TEXT,                       -- 'YYYY-MM-DD'
  end_date    TEXT,
  notes       TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_medications_profile ON medications(profile_id, active);
