-- Reminders: 'manual' (user-created) and 'derived' (auto-generated from app data
-- via a stable dedupe_key — dose times, water pings, task/schedule reminders,
-- recheck-due, etc.). Snooze/dismiss state on derived reminders is preserved
-- across re-sync because the sync merges on dedupe_key.

CREATE TABLE IF NOT EXISTS reminders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id    INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','derived')),
  source        TEXT,                    -- 'water','task','schedule','medication','metric',...
  dedupe_key    TEXT UNIQUE,             -- set for derived; null for manual
  title         TEXT NOT NULL,
  detail        TEXT,
  due_date      TEXT NOT NULL,           -- 'YYYY-MM-DD'
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','dismissed')),
  snoozed_until TEXT,                     -- 'YYYY-MM-DD' or null
  last_fired_on TEXT,                     -- 'YYYY-MM-DD' the OS notification last fired
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status, due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_profile ON reminders(profile_id);
