-- Health profiles — the backbone. Self + family members. Everything else
-- (metrics, goals, meds, tasks, reminders) is scoped to a profile.

CREATE TABLE IF NOT EXISTS profiles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  relationship  TEXT,                       -- common:relationship value; null for self
  is_self       INTEGER NOT NULL DEFAULT 0, -- exactly one profile should be self
  dob           TEXT,                       -- 'YYYY-MM-DD'
  sex           TEXT CHECK (sex IN ('female','male','other','unspecified')) DEFAULT 'unspecified',
  blood_group   TEXT,                       -- e.g. 'O+', 'AB-'
  height_cm     REAL,
  photo_ref     TEXT,                       -- vault blob file name (optional)
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_self ON profiles(is_self);

-- Per-profile medical baseline, one row per item, so allergies/conditions/etc.
-- are queryable and editable individually.
CREATE TABLE IF NOT EXISTS profile_baseline (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN (
                'allergy','condition','medication_note','surgery','lifestyle','family_history'
              )),
  label       TEXT NOT NULL,
  detail      TEXT,
  severity    TEXT CHECK (severity IN ('mild','moderate','severe')) ,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_baseline_profile ON profile_baseline(profile_id, kind);
