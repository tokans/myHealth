-- Daily habits — the Starter-tier engagement engine (Today view): custom daily
-- tasks, water intake, and the (Tracker-tier) daily/weekly schedule.

CREATE TABLE IF NOT EXISTS daily_tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id    INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  recurrence    TEXT NOT NULL DEFAULT 'daily', -- 'daily' | 'weekdays' | CSV of 0-6 (Sun=0)
  reminder_time TEXT,                           -- 'HH:MM' local, optional
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_profile ON daily_tasks(profile_id, active);

CREATE TABLE IF NOT EXISTS task_completions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id   INTEGER NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
  done_on   TEXT NOT NULL,                       -- 'YYYY-MM-DD'
  UNIQUE (task_id, done_on)
);

-- One row per profile per day; glasses incremented via +1 quick-add.
CREATE TABLE IF NOT EXISTS water_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id     INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day            TEXT NOT NULL,                   -- 'YYYY-MM-DD'
  glasses        INTEGER NOT NULL DEFAULT 0,
  target_glasses INTEGER NOT NULL DEFAULT 8,
  UNIQUE (profile_id, day)
);

CREATE INDEX IF NOT EXISTS idx_water_profile_day ON water_log(profile_id, day);

-- Planned day/week blocks (Tracker tier): meds, meals, activity, appointments.
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'activity' CHECK (kind IN ('medication','meal','activity','appointment','other')),
  title       TEXT NOT NULL,
  start_min   INTEGER NOT NULL,                   -- minutes from midnight
  end_min     INTEGER,
  days        TEXT NOT NULL DEFAULT 'daily',      -- 'daily' | 'weekdays' | CSV 0-6
  ref         TEXT,                               -- optional link to a med/appointment id
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_schedule_profile ON schedule_blocks(profile_id);
