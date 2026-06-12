/**
 * myHealth's aux-SQL migrations against the shared suite DB (CONTRACT §8.6) — the
 * versioned raw-SQL channel for what SchemaDescriptors can't express. This REPLACES the
 * retired per-app Tauri-plugin migration array (src-tauri 0001–0009): the behaviors those
 * migrations encoded as composite indexes, FK ON DELETE actions, and CHECK constraints
 * are re-expressed here against the namespaced `myhealth_*` tables.
 *
 * Rules (enforced by core): steps are append-only per app — NEVER edit an applied step,
 * add a new version instead — and every statement may reference ONLY tables owned by
 * `myhealth` in the registry. Run via `registerAuxMigrations(db, APP_ID, MYHEALTH_AUX_MIGRATIONS)`
 * AFTER `registerSchemas` (see sharedDb.ts).
 *
 * Note: enum CHECKs from the legacy DDL are enforced as BEFORE INSERT/UPDATE trigger
 * guards (SQLite can't ALTER ADD a CHECK); NULL passes where the legacy CHECK passed
 * NULL. The legacy `profiles.sex` CHECK moved with the field onto `myhealth#HealthFacet`
 * (descriptor enum, app-validated) and has no physical guard here.
 */
import type { AuxMigrationStep } from "sharedcorelib/db";

/** Build a BEFORE INSERT + BEFORE UPDATE RAISE(ABORT) pair guarding enum columns. */
function enumGuard(table: string, when: string): string[] {
  return ["insert", "update"].map(
    (op) =>
      `CREATE TRIGGER IF NOT EXISTS trg_${table}_${op}_enum BEFORE ${op.toUpperCase()} ON ${table} ` +
      `WHEN ${when} BEGIN SELECT RAISE(ABORT, 'enum constraint failed on ${table}'); END`,
  );
}

const notIn = (col: string, values: string[], nullable: boolean): string => {
  const list = values.map((v) => `'${v}'`).join(",");
  return nullable
    ? `(NEW.${col} IS NOT NULL AND NEW.${col} NOT IN (${list}))`
    : `NEW.${col} NOT IN (${list})`;
};

export const MYHEALTH_AUX_MIGRATIONS: AuxMigrationStep[] = [
  {
    version: 1,
    sql: [
      // ── composite / covering indexes (legacy 0002–0009 index parity) ────────
      `CREATE INDEX IF NOT EXISTS ix_myhealth_baseline_profile ON myhealth_profile_baseline (profile_id, kind)`,
      `CREATE INDEX IF NOT EXISTS ix_myhealth_metrics_profile_kind ON myhealth_metrics (profile_id, kind, taken_at)`,
      `CREATE INDEX IF NOT EXISTS ix_myhealth_goals_profile_status ON myhealth_goals (profile_id, status)`,
      `CREATE INDEX IF NOT EXISTS ix_myhealth_reminders_due ON myhealth_reminders (status, due_date)`,
      `CREATE INDEX IF NOT EXISTS ix_myhealth_tasks_profile_active ON myhealth_daily_tasks (profile_id, active)`,
      `CREATE INDEX IF NOT EXISTS ix_myhealth_medications_profile_active ON myhealth_medications (profile_id, active)`,
      `CREATE INDEX IF NOT EXISTS ix_myhealth_documents_profile_date ON myhealth_documents (profile_id, doc_date)`,
      // UNIQUE constraints the wrappers' ON CONFLICT(...) clauses target:
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_myhealth_task_completions ON myhealth_task_completions (task_id, done_on)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_myhealth_water_profile_day ON myhealth_water_log (profile_id, day)`,

      // ── cascade triggers (legacy FK ON DELETE CASCADE / SET NULL parity) ────
      `CREATE TRIGGER IF NOT EXISTS trg_myhealth_profiles_delete AFTER DELETE ON myhealth_profiles BEGIN ` +
        `DELETE FROM myhealth_profile_baseline WHERE profile_id = OLD.id; ` +
        `DELETE FROM myhealth_metrics WHERE profile_id = OLD.id; ` +
        `DELETE FROM myhealth_goals WHERE profile_id = OLD.id; ` +
        `DELETE FROM myhealth_reminders WHERE profile_id = OLD.id; ` +
        `DELETE FROM myhealth_task_completions WHERE task_id IN (SELECT id FROM myhealth_daily_tasks WHERE profile_id = OLD.id); ` +
        `DELETE FROM myhealth_daily_tasks WHERE profile_id = OLD.id; ` +
        `DELETE FROM myhealth_water_log WHERE profile_id = OLD.id; ` +
        `DELETE FROM myhealth_schedule_blocks WHERE profile_id = OLD.id; ` +
        `DELETE FROM myhealth_medications WHERE profile_id = OLD.id; ` +
        `UPDATE myhealth_documents SET profile_id = NULL WHERE profile_id = OLD.id; ` +
        `END`,
      `CREATE TRIGGER IF NOT EXISTS trg_myhealth_tasks_delete AFTER DELETE ON myhealth_daily_tasks BEGIN ` +
        `DELETE FROM myhealth_task_completions WHERE task_id = OLD.id; ` +
        `END`,

      // ── enum CHECK guards (legacy CHECK(...) parity) ─────────────────────────
      ...enumGuard(
        "myhealth_profile_baseline",
        notIn("kind", ["allergy", "condition", "medication_note", "surgery", "lifestyle", "family_history"], false) +
          ` OR ` +
          notIn("severity", ["mild", "moderate", "severe"], true),
      ),
      ...enumGuard("myhealth_metrics", notIn("source", ["manual", "import", "device"], false)),
      ...enumGuard(
        "myhealth_goals",
        notIn("direction", ["decrease", "increase", "maintain"], true) +
          ` OR ` +
          notIn("status", ["active", "achieved", "archived"], false),
      ),
      ...enumGuard(
        "myhealth_reminders",
        notIn("kind", ["manual", "derived"], false) + ` OR ` + notIn("status", ["open", "done", "dismissed"], false),
      ),
      ...enumGuard(
        "myhealth_schedule_blocks",
        notIn("kind", ["medication", "meal", "activity", "appointment", "other"], false),
      ),
      ...enumGuard(
        "myhealth_documents",
        notIn("doc_type", ["prescription", "lab_report", "discharge", "imaging", "insurance", "bill", "id", "other"], false),
      ),

      // ── default settings seed (legacy 0001 parity; harmless for migrated DBs:
      //     the one-time migrator runs before first use and OR IGNORE keeps copies) ──
      `INSERT OR IGNORE INTO myhealth_settings (key, value) VALUES ('locale', 'en')`,
      `INSERT OR IGNORE INTO myhealth_settings (key, value) VALUES ('date_format', 'DD/MM/YYYY')`,
      `INSERT OR IGNORE INTO myhealth_settings (key, value) VALUES ('units', 'metric')`,
      `INSERT OR IGNORE INTO myhealth_settings (key, value) VALUES ('theme', 'system')`,
    ],
  },
];
