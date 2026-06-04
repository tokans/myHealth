-- myHealth core schema, version 1: settings + local usage telemetry.

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

-- Local-only usage telemetry. NEVER transmitted — it only unlocks engagement
-- tiers on-device (see src/lib/gamification.ts). One row per distinct local day.
CREATE TABLE IF NOT EXISTS app_launches (
  launch_day TEXT PRIMARY KEY NOT NULL,   -- 'YYYY-MM-DD' (local)
  opens      INTEGER NOT NULL DEFAULT 1,
  first_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default settings. The app overwrites these once the user saves.
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('locale',      'en'),
  ('date_format', 'DD/MM/YYYY'),
  ('units',       'metric'),   -- 'metric' | 'imperial'
  ('theme',       'system');
