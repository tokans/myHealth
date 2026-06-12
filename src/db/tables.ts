/**
 * Physical (namespaced) table names for myHealth's app-owned tables in the ONE shared
 * suite DB. These are the `dbAlias` values from the SchemaDescriptors in appTables.ts;
 * every legacy wrapper references the suite table through these constants so there is a
 * single source of truth and no stray bare legacy names survive the consolidation.
 *
 * The per-app `myhealth.db` and its Tauri-plugin migration array are retired (CONTRACT
 * §8.6) — all reads/writes go through suite.db (`shared_core_db_path`).
 */
export const T = {
  settings: "myhealth_settings",
  appLaunches: "myhealth_app_launches",
  profiles: "myhealth_profiles",
  profileBaseline: "myhealth_profile_baseline",
  metrics: "myhealth_metrics",
  goals: "myhealth_goals",
  reminders: "myhealth_reminders",
  dailyTasks: "myhealth_daily_tasks",
  taskCompletions: "myhealth_task_completions",
  waterLog: "myhealth_water_log",
  scheduleBlocks: "myhealth_schedule_blocks",
  medications: "myhealth_medications",
  documents: "myhealth_documents",
  migrationLedger: "myhealth_migration_ledger",
} as const;
