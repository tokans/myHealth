/**
 * myHealth's app-owned tables in the ONE shared suite DB (K1 consolidation, prompts/10).
 *
 * Every table the app used to keep in its own `myhealth.db` (Tauri-plugin migrations
 * 0001–0009) is now a SEMANTIC SchemaDescriptor registered into the suite registry and
 * physically namespaced `myhealth_*` via `dbAlias`. The per-app SQLite file and its
 * plugin migration array are retired (CONTRACT §8.6); what descriptors can't express
 * (composite indexes, cascade triggers, enum CHECK guards) lives in the versioned
 * aux-SQL steps (see auxMigrations.ts).
 *
 * Spine-shaped data is NOT duplicated here (invariant 6):
 *  - the legacy `profiles` table collapsed onto the common person spine + the
 *    `myhealth#HealthFacet`; what remains is `myhealth#Profile` — a THIN link table
 *    (integer app id ↔ `person_key`) so the app's historical integer keying keeps
 *    working while identity/medical truth lives on `common#Person` + the facet.
 *  - the legacy `documents` table stays a self-contained `myhealth#Document` table
 *    (the live store the Documents page keys on); its `extracted_text` plaintext column
 *    becomes `extracted_text_enc` — **vault-sealed ciphertext** (decision #26), tagged
 *    `Secret` so backup exports hash it. The `common#Document` spine is mirrored for
 *    cross-app timeline reads but the page does not write through it yet (see below).
 *
 * Confidentiality: health data is sensitive — medical tables are `Restricted` with
 * `personalData: true` (DPDP) on person-derived fields; wellness/engagement tables are
 * `Confidential`; settings/telemetry are `Internal`. `extracted_text_enc` is `Secret`.
 * Nothing here egresses — local SQLite only.
 */
import type { SchemaDescriptor, FieldDescriptor } from "sharedcorelib/schema";
import { APP_ID } from "./healthFacet";

/** Integer app-side id (REAL affinity in the suite DB; values stay integral). */
const idField = (description: string): FieldDescriptor => ({
  name: "id",
  dataType: "number",
  keyField: true,
  editability: "Immutable",
  description,
});

const profileIdField = (purpose: string): FieldDescriptor => ({
  name: "profile_id",
  dataType: "number",
  index: "NonUnique",
  description: "myhealth#Profile id this row is scoped to",
  purpose,
  personalData: true,
});

const createdAtField: FieldDescriptor = {
  name: "created_at",
  dataType: "date",
  description: "ISO timestamp of row creation (stamped by the app)",
};

/** `myhealth_settings` — app settings key/value (locale, units, theme, …). */
export const SETTINGS_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "Setting",
  plural: "Settings",
  dbAlias: "myhealth_settings",
  schemaType: "Table",
  confidentiality: "Internal",
  owner: APP_ID,
  purpose: "App preference key/value store (locale, date format, units, theme).",
  fields: [
    { name: "key", dataType: "string", keyField: true, editability: "Immutable", description: "setting key" },
    { name: "value", dataType: "string", required: true, description: "setting value" },
  ],
};

/** `myhealth_app_launches` — LOCAL-ONLY usage telemetry; never transmitted. */
export const APP_LAUNCH_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "AppLaunch",
  plural: "AppLaunches",
  dbAlias: "myhealth_app_launches",
  schemaType: "Table",
  confidentiality: "Internal",
  owner: APP_ID,
  purpose:
    "Local-only engagement telemetry (one row per distinct local day) that unlocks tiers on-device. NEVER transmitted.",
  fields: [
    { name: "launch_day", dataType: "date", keyField: true, editability: "Immutable", description: "'YYYY-MM-DD' (local)" },
    { name: "opens", dataType: "number", required: true, description: "opens that day" },
    { name: "first_at", dataType: "date", description: "first open timestamp" },
    { name: "last_at", dataType: "date", description: "last open timestamp" },
  ],
};

/**
 * `myhealth_profiles` — THIN spine link, not an identity table. Identity lives on
 * `common#Person` (display name, relationship, dob, contacts) and the medical fields on
 * `myhealth#HealthFacet`; this table only maps the app's historical integer profile id
 * to a `person_key` plus the app-local extras (photo blob ref, ICE contact name).
 */
export const PROFILE_LINK_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "Profile",
  plural: "Profiles",
  dbAlias: "myhealth_profiles",
  schemaType: "Table",
  confidentiality: "Confidential",
  owner: APP_ID,
  purpose:
    "Maps myHealth's historical integer profile id onto the shared person spine (person_key); identity itself is NOT re-modeled here (invariant 6).",
  fields: [
    idField("app-side integer profile id (the FK every legacy table keys on)"),
    {
      name: "person_key",
      dataType: "id",
      required: true,
      index: "Unique",
      description: "shared person key on common#Person (same key as the facet + ICE card)",
    },
    {
      name: "photo_ref",
      dataType: "string",
      personalData: true,
      purpose: "Recognize this person in the UI.",
      description: "vault blob uuid of the avatar (optional; bytes stay AES-GCM sealed)",
    },
    {
      name: "emergency_contact",
      dataType: "string",
      confidentiality: "Restricted",
      personalData: true,
      purpose: "Emergency contact display name for the printed medical ICE card.",
      description: "emergency contact name (phone/email live on common#Person)",
    },
    createdAtField,
  ],
  relationships: [
    {
      name: "person",
      relationshipType: "Many-One",
      relatedSchema: "common#Person",
      description: "the shared identity this profile id points at",
    },
  ],
};

/** `myhealth_profile_baseline` — per-profile medical baseline items. */
export const BASELINE_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "BaselineItem",
  plural: "BaselineItems",
  dbAlias: "myhealth_profile_baseline",
  schemaType: "Table",
  confidentiality: "Restricted",
  owner: APP_ID,
  purpose: "Queryable per-profile medical baseline (allergies, conditions, surgeries, …), one row per item.",
  fields: [
    idField("baseline item id"),
    profileIdField("Scope baseline items to a person's profile."),
    {
      name: "kind",
      dataType: "enum",
      required: true,
      constraints: { enumValues: ["allergy", "condition", "medication_note", "surgery", "lifestyle", "family_history"] },
      description: "baseline item kind",
    },
    { name: "label", dataType: "string", required: true, personalData: true, purpose: "Record the medical baseline item.", description: "item label" },
    { name: "detail", dataType: "string", personalData: true, purpose: "Free-text detail for the item.", description: "detail (optional)" },
    { name: "severity", dataType: "enum", constraints: { enumValues: ["mild", "moderate", "severe"] }, description: "severity (optional)" },
    createdAtField,
  ],
};

/** `myhealth_metrics` — vitals / lab time-series. */
export const METRIC_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "Metric",
  plural: "Metrics",
  dbAlias: "myhealth_metrics",
  schemaType: "Table",
  confidentiality: "Restricted",
  owner: APP_ID,
  purpose: "Vitals/lab readings time-series per profile, with provenance for imported values.",
  fields: [
    idField("reading id"),
    profileIdField("Scope readings to a person's profile."),
    { name: "kind", dataType: "string", required: true, description: "'weight','bp_systolic','glucose_fasting',…" },
    { name: "value", dataType: "number", required: true, personalData: true, purpose: "Record the health reading.", description: "reading value" },
    { name: "unit", dataType: "string", description: "'kg','mmHg','mg/dL',…" },
    { name: "taken_at", dataType: "date", required: true, description: "'YYYY-MM-DD' or full datetime" },
    {
      name: "source",
      dataType: "enum",
      required: true,
      constraints: { enumValues: ["manual", "import", "device"] },
      description: "provenance",
    },
    { name: "confidence", dataType: "number", description: "0..1 for imported values; null for manual" },
    { name: "note", dataType: "string", personalData: true, purpose: "Free-text context for the reading.", description: "note (optional)" },
    createdAtField,
  ],
};

/** `myhealth_goals` — health goals with deterministic projection. */
export const GOAL_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "Goal",
  plural: "Goals",
  dbAlias: "myhealth_goals",
  schemaType: "Table",
  confidentiality: "Restricted",
  owner: APP_ID,
  purpose: "Per-profile health goals; projection computed deterministically in-app (domain/goals.ts).",
  fields: [
    idField("goal id"),
    profileIdField("Scope goals to a person's profile."),
    { name: "kind", dataType: "string", required: true, description: "'weight','vital','fitness','habit','preventive'" },
    { name: "title", dataType: "string", required: true, personalData: true, purpose: "Human label for the goal.", description: "goal title" },
    { name: "metric_kind", dataType: "string", description: "links to metrics.kind when measurable" },
    { name: "baseline", dataType: "number", description: "starting value" },
    { name: "target", dataType: "number", description: "target value" },
    { name: "unit", dataType: "string", description: "unit of measure" },
    { name: "direction", dataType: "enum", constraints: { enumValues: ["decrease", "increase", "maintain"] }, description: "goal direction" },
    { name: "target_date", dataType: "date", description: "'YYYY-MM-DD' (optional)" },
    { name: "status", dataType: "enum", required: true, constraints: { enumValues: ["active", "achieved", "archived"] }, description: "goal status" },
    createdAtField,
    { name: "archived_at", dataType: "date", description: "when archived (optional)" },
  ],
};

/** `myhealth_reminders` — manual + derived reminders (snooze/dismiss preserved via dedupe_key). */
export const REMINDER_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "Reminder",
  plural: "Reminders",
  dbAlias: "myhealth_reminders",
  schemaType: "Table",
  confidentiality: "Restricted",
  owner: APP_ID,
  purpose:
    "Manual and derived reminders (dose times, water pings, rechecks); derived rows merge on dedupe_key so snooze/dismiss state survives re-sync.",
  fields: [
    idField("reminder id"),
    profileIdField("Scope reminders to a person's profile."),
    { name: "kind", dataType: "enum", required: true, constraints: { enumValues: ["manual", "derived"] }, description: "reminder kind" },
    { name: "source", dataType: "string", description: "'water','task','schedule','medication','metric',…" },
    { name: "dedupe_key", dataType: "string", index: "Unique", description: "stable key for derived reminders; null for manual" },
    { name: "title", dataType: "string", required: true, personalData: true, purpose: "Human label for the reminder (may name a medication).", description: "title" },
    { name: "detail", dataType: "string", personalData: true, purpose: "Free-text detail for the reminder.", description: "detail (optional)" },
    { name: "due_date", dataType: "date", required: true, description: "'YYYY-MM-DD'" },
    { name: "status", dataType: "enum", required: true, constraints: { enumValues: ["open", "done", "dismissed"] }, description: "reminder status" },
    { name: "snoozed_until", dataType: "date", description: "'YYYY-MM-DD' or null" },
    { name: "last_fired_on", dataType: "date", description: "'YYYY-MM-DD' the OS notification last fired" },
    createdAtField,
  ],
};

/** `myhealth_daily_tasks` — custom daily habit tasks. */
export const DAILY_TASK_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "DailyTask",
  plural: "DailyTasks",
  dbAlias: "myhealth_daily_tasks",
  schemaType: "Table",
  confidentiality: "Confidential",
  owner: APP_ID,
  purpose: "Per-profile recurring daily habit tasks (the Today view engagement engine).",
  fields: [
    idField("task id"),
    profileIdField("Scope tasks to a person's profile."),
    { name: "title", dataType: "string", required: true, personalData: true, purpose: "Human label for the habit task.", description: "task title" },
    { name: "recurrence", dataType: "string", required: true, description: "'daily' | 'weekdays' | CSV of 0-6 (Sun=0)" },
    { name: "reminder_time", dataType: "string", description: "'HH:MM' local (optional)" },
    { name: "active", dataType: "boolean", required: true, description: "1 = active" },
    createdAtField,
  ],
};

/** `myhealth_task_completions` — one row per task per completed day. */
export const TASK_COMPLETION_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "TaskCompletion",
  plural: "TaskCompletions",
  dbAlias: "myhealth_task_completions",
  schemaType: "Table",
  confidentiality: "Confidential",
  owner: APP_ID,
  purpose: "Daily habit-task completion marks (unique per task per day via aux-SQL index).",
  fields: [
    idField("completion id"),
    { name: "task_id", dataType: "number", required: true, index: "NonUnique", description: "myhealth#DailyTask id" },
    { name: "done_on", dataType: "date", required: true, description: "'YYYY-MM-DD'" },
  ],
};

/** `myhealth_water_log` — one row per profile per day. */
export const WATER_LOG_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "WaterDay",
  plural: "WaterDays",
  dbAlias: "myhealth_water_log",
  schemaType: "Table",
  confidentiality: "Confidential",
  owner: APP_ID,
  purpose: "Daily water intake per profile (unique per profile per day via aux-SQL index).",
  fields: [
    idField("water day id"),
    profileIdField("Scope water intake to a person's profile."),
    { name: "day", dataType: "date", required: true, description: "'YYYY-MM-DD'" },
    { name: "glasses", dataType: "number", required: true, description: "glasses drunk" },
    { name: "target_glasses", dataType: "number", required: true, description: "daily target" },
  ],
};

/** `myhealth_schedule_blocks` — planned day/week blocks (meds, meals, activity, appointments). */
export const SCHEDULE_BLOCK_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "ScheduleBlock",
  plural: "ScheduleBlocks",
  dbAlias: "myhealth_schedule_blocks",
  schemaType: "Table",
  confidentiality: "Restricted",
  owner: APP_ID,
  purpose: "Planned day/week blocks per profile; medication blocks reveal health info, hence Restricted.",
  fields: [
    idField("block id"),
    profileIdField("Scope schedule blocks to a person's profile."),
    {
      name: "kind",
      dataType: "enum",
      required: true,
      constraints: { enumValues: ["medication", "meal", "activity", "appointment", "other"] },
      description: "block kind",
    },
    { name: "title", dataType: "string", required: true, personalData: true, purpose: "Human label for the block (may name a medication).", description: "block title" },
    { name: "start_min", dataType: "number", required: true, description: "minutes from midnight" },
    { name: "end_min", dataType: "number", description: "minutes from midnight (optional)" },
    { name: "days", dataType: "string", required: true, description: "'daily' | 'weekdays' | CSV 0-6" },
    { name: "ref", dataType: "string", description: "optional link to a med/appointment id" },
    createdAtField,
  ],
};

/** `myhealth_medications` — medications per profile. */
export const MEDICATION_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "Medication",
  plural: "Medications",
  dbAlias: "myhealth_medications",
  schemaType: "Table",
  confidentiality: "Restricted",
  owner: APP_ID,
  purpose: "Per-profile medications; active ones feed derived dose reminders and the ICE card.",
  fields: [
    idField("medication id"),
    profileIdField("Scope medications to a person's profile."),
    { name: "drug", dataType: "string", required: true, personalData: true, purpose: "Record the prescribed drug.", description: "drug name" },
    { name: "strength", dataType: "string", description: "e.g. '500 mg'" },
    { name: "form", dataType: "string", description: "'tablet','capsule','syrup',…" },
    { name: "schedule", dataType: "string", description: "'OD','BD','TDS','QID','PRN','custom'" },
    { name: "times", dataType: "string", description: "optional CSV of 'HH:MM'" },
    { name: "prescriber", dataType: "string", personalData: true, purpose: "Record who prescribed the medication.", description: "prescriber (optional)" },
    { name: "start_date", dataType: "date", description: "'YYYY-MM-DD' (optional)" },
    { name: "end_date", dataType: "date", description: "'YYYY-MM-DD' (optional)" },
    { name: "notes", dataType: "string", personalData: true, purpose: "Free-text context for the medication.", description: "notes (optional)" },
    { name: "active", dataType: "boolean", required: true, description: "1 = currently taken" },
    createdAtField,
  ],
};

/**
 * `myhealth_documents` — medical document metadata (the live store the Documents page
 * keys on). Document BYTES stay AES-256-GCM vault blobs under the per-device DEK; only
 * the opaque `file_name` (the vault blob uuid) lands here. `extracted_text_enc` is
 * **vault-sealed ciphertext** of the OCR/import extraction (decision #26, sealed via the
 * SAME `vault.sealBytes` DEK primitive) — `Secret`, so the backup exporter emits only a
 * sha256 fingerprint, never the value. This fixes the legacy bug where
 * `documents.extracted_text` was PLAINTEXT while the blob bytes were encrypted.
 *
 * Spine note (invariant 6): the shared `common#Document` spine exists and is mirrored for
 * cross-app timeline reads via `db/sharedTimeline.ts`, but the medical Documents page does
 * NOT yet write through it — so this table is the app's self-contained live store, not a
 * duplicate of actively-used spine data. A later pass can collapse title/blob_ref/mime
 * onto `common#Document` once the page is rewired through the timeline store.
 */
export const DOCUMENT_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "Document",
  plural: "Documents",
  dbAlias: "myhealth_documents",
  schemaType: "Table",
  confidentiality: "Restricted",
  owner: APP_ID,
  purpose:
    "Medical document metadata (type, title, provider, date, blob ref, size, sealed extracted text); bytes stay AES-GCM vault blobs.",
  fields: [
    idField("app-side integer document id (the id pages key on)"),
    profileIdField("Scope documents to a person's profile."),
    {
      name: "doc_type",
      dataType: "enum",
      required: true,
      constraints: {
        enumValues: ["prescription", "lab_report", "discharge", "imaging", "insurance", "bill", "id", "other"],
      },
      description: "medical document kind",
    },
    { name: "title", dataType: "string", required: true, personalData: true, purpose: "Human label for the medical document.", description: "document title" },
    { name: "provider", dataType: "string", personalData: true, purpose: "Record the issuing provider/clinic.", description: "provider (optional)" },
    { name: "doc_date", dataType: "date", description: "'YYYY-MM-DD' (optional)" },
    { name: "file_name", dataType: "string", required: true, description: "vault blob uuid (bytes are AES-GCM sealed; never plaintext here)" },
    { name: "mime", dataType: "string", description: "MIME type (optional)" },
    { name: "size_bytes", dataType: "number", description: "original file size" },
    {
      name: "extracted_text_enc",
      dataType: "string",
      confidentiality: "Secret",
      personalData: true,
      purpose: "Searchable text extracted from the medical document — vault-sealed (AES-256-GCM under the per-device DEK), never stored in plaintext.",
      description: "vault-sealed extracted text: 'scv1:' + base64(GCM sealed bytes); null when not extracted",
    },
    createdAtField,
  ],
};

/** `myhealth_migration_ledger` — evidence ledger for the one-time legacy-DB consolidation. */
export const MIGRATION_LEDGER_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "MigrationLedger",
  plural: "MigrationLedgers",
  dbAlias: "myhealth_migration_ledger",
  schemaType: "Table",
  confidentiality: "Internal",
  owner: APP_ID,
  purpose:
    "Per-table evidence (row counts + checksum sample) of the one-time legacy myhealth.db → suite.db migration; makes the migrator idempotent/resumable.",
  fields: [
    { name: "table_name", dataType: "string", keyField: true, editability: "Immutable", description: "legacy table name (or '__all__' / '__legacy_db__')" },
    { name: "status", dataType: "string", required: true, description: "'verified' | 'complete' | 'deleted'" },
    { name: "rows_copied", dataType: "number", description: "rows copied for this table" },
    { name: "checksum", dataType: "string", description: "sha256 over the verification sample" },
    { name: "detail", dataType: "string", description: "free-text evidence / warnings" },
    { name: "completed_at", dataType: "date", description: "ISO timestamp" },
  ],
};

/** Every app-owned suite table myHealth registers (legacy tables, descriptor-ized). */
export const APP_TABLE_SCHEMAS: SchemaDescriptor[] = [
  SETTINGS_SCHEMA,
  APP_LAUNCH_SCHEMA,
  PROFILE_LINK_SCHEMA,
  BASELINE_SCHEMA,
  METRIC_SCHEMA,
  GOAL_SCHEMA,
  REMINDER_SCHEMA,
  DAILY_TASK_SCHEMA,
  TASK_COMPLETION_SCHEMA,
  WATER_LOG_SCHEMA,
  SCHEDULE_BLOCK_SCHEMA,
  MEDICATION_SCHEMA,
  DOCUMENT_SCHEMA,
  MIGRATION_LEDGER_SCHEMA,
];
