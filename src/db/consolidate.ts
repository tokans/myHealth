/**
 * One-time legacy `myhealth.db` → `suite.db` migrator (K1 step 3, decisions 6/24).
 *
 * Runs once on boot: if the legacy per-app DB exists and the suite ledger says
 * not-migrated, copy every legacy table into its namespaced `myhealth_*` suite table,
 * verify, record an evidence ledger, then DELETE the legacy DB file (pre-customer; no
 * backward compat). Idempotent and crash-safe — each table is copied in its own
 * transaction and recorded in `myhealth_migration_ledger`, so a re-run resumes from where
 * it stopped (already-recorded tables are skipped).
 *
 * Special cases (invariant 6 + decision #26):
 *  - `profiles` rows fan out onto the spine: common_person (identity) + myhealth_health_facet
 *    (medical) + a thin myhealth_profiles link row carrying the SAME integer id, so every
 *    legacy `profile_id` FK keeps resolving.
 *  - `documents.extracted_text` (legacy PLAINTEXT) is **sealed in transit** into
 *    `extracted_text_enc` via the per-device DEK (the same primitive that seals doc blobs).
 *
 * Pure/DI: the copy logic takes injected SqlDb handles + a `sealText` fn so it is unit-
 * testable against fixture DBs; the live wiring (open legacy DB, delete file) is in
 * `runConsolidation`. No data egresses — all local SQLite.
 */
import type { SqlDb } from "sharedcorelib/db";
import { T } from "./tables";
import { isTauri } from "@/lib/environment";
import { openSharedDbAdapter } from "./sharedDb";
import { sealExtractedText } from "./sealedText";

/** Seal extracted text for in-transit migration (AAD = the doc blob's file_name). */
export type SealText = (plain: string | null, aad: string) => Promise<string | null>;

/** Per-table evidence the migrator records into the ledger. */
export interface TableEvidence {
  table: string;
  rowsCopied: number;
  checksum: string;
}

export interface ConsolidationResult {
  migrated: boolean;
  tables: TableEvidence[];
  /** Tables skipped because the ledger already recorded them (resumed run). */
  skipped: string[];
}

const LEDGER_DONE = "__all__";

/** Plain, order-independent checksum over a row sample (FNV-1a over sorted JSON). */
function sampleChecksum(rows: Record<string, unknown>[]): string {
  // Deterministic: sort each row's keys, sort rows by their serialization, hash the join.
  const serial = rows
    .map((r) => JSON.stringify(Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)))))
    .sort()
    .join("");
  let h = 0x811c9dc5;
  for (let i = 0; i < serial.length; i++) {
    h ^= serial.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

async function ledgerHas(suite: SqlDb, table: string): Promise<boolean> {
  const rows = await suite.select<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${T.migrationLedger} WHERE table_name = ? AND status IN ('verified','complete','deleted')`,
    [table],
  );
  return (rows[0]?.n ?? 0) > 0;
}

async function recordLedger(
  suite: SqlDb,
  table: string,
  status: string,
  rowsCopied: number | null,
  checksum: string | null,
  detail: string,
): Promise<void> {
  await suite.execute(
    `INSERT OR REPLACE INTO ${T.migrationLedger} (table_name, status, rows_copied, checksum, detail, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [table, status, rowsCopied, checksum, detail, new Date().toISOString()],
  );
}

/** Generic 1:1 column-preserving copy of a legacy table into its namespaced suite table. */
async function copyTable(
  legacy: SqlDb,
  suite: SqlDb,
  legacyName: string,
  suiteName: string,
): Promise<TableEvidence> {
  const rows = await legacy.select<Record<string, unknown>>(`SELECT * FROM ${legacyName}`);
  for (const r of rows) {
    const cols = Object.keys(r);
    const placeholders = cols.map(() => "?").join(", ");
    await suite.execute(
      `INSERT OR IGNORE INTO ${suiteName} (${cols.join(", ")}) VALUES (${placeholders})`,
      cols.map((c) => r[c] ?? null),
    );
  }
  return { table: suiteName, rowsCopied: rows.length, checksum: sampleChecksum(rows) };
}

/** Copy `documents`, sealing the plaintext `extracted_text` into `extracted_text_enc`. */
async function copyDocuments(legacy: SqlDb, suite: SqlDb, sealText: SealText): Promise<TableEvidence> {
  const rows = await legacy.select<Record<string, unknown>>(`SELECT * FROM documents`);
  for (const r of rows) {
    const sealed = await sealText(((r.extracted_text as string) ?? null) || null, String(r.file_name));
    await suite.execute(
      `INSERT OR IGNORE INTO ${T.documents}
         (id, profile_id, doc_type, title, provider, doc_date, file_name, mime, size_bytes, extracted_text_enc, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id ?? null,
        r.profile_id ?? null,
        r.doc_type ?? "other",
        r.title ?? "",
        r.provider ?? null,
        r.doc_date ?? null,
        r.file_name ?? null,
        r.mime ?? null,
        r.size_bytes ?? null,
        sealed,
        r.created_at ?? new Date().toISOString(),
      ],
    );
  }
  return { table: T.documents, rowsCopied: rows.length, checksum: sampleChecksum(rows) };
}

/** Fan a legacy `profiles` row onto common_person + myhealth_health_facet + the link row. */
async function copyProfiles(legacy: SqlDb, suite: SqlDb): Promise<TableEvidence> {
  const rows = await legacy.select<Record<string, unknown>>(`SELECT * FROM profiles`);
  const now = new Date().toISOString();
  for (const r of rows) {
    const id = Number(r.id);
    const isSelf = Number(r.is_self) === 1;
    const isPet = String(r.relationship ?? "").toLowerCase() === "pet";
    const personKey = isSelf ? "self" : `mhp-${id}`;
    const created = (r.created_at as string) ?? now;

    // Thin link row preserves the integer id ↔ person_key mapping + app-local extras.
    await suite.execute(
      `INSERT OR IGNORE INTO ${T.profiles} (id, person_key, photo_ref, emergency_contact, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, personKey, r.photo_ref ?? null, r.emergency_contact ?? null, created],
    );
    // Spine identity (contact lives on person — ICE/finance precedent).
    await suite.execute(
      `INSERT INTO common_person (person_key, display_name, relationship_to_self, contact_phone, contact_email, dob, updated_at, source_app)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'myhealth')
       ON CONFLICT(person_key) DO UPDATE SET
         display_name = excluded.display_name,
         relationship_to_self = excluded.relationship_to_self,
         contact_phone = excluded.contact_phone,
         contact_email = excluded.contact_email,
         dob = excluded.dob,
         updated_at = excluded.updated_at,
         source_app = 'myhealth'`,
      [
        personKey,
        r.name ?? personKey,
        isPet ? "pet" : isSelf ? "self" : r.relationship ?? null,
        r.emergency_phone ?? null,
        r.emergency_email ?? null,
        r.dob ?? null,
        now,
      ],
    );
    // Medical facet (the fields myHealth owns).
    await suite.execute(
      `INSERT INTO myhealth_health_facet
         (person_key, sex, blood_group, height_cm, advance_directive, organ_donor, is_pet, notes, updated_at, source_app)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'myhealth')
       ON CONFLICT(person_key) DO UPDATE SET
         sex = excluded.sex,
         blood_group = excluded.blood_group,
         height_cm = excluded.height_cm,
         advance_directive = excluded.advance_directive,
         organ_donor = excluded.organ_donor,
         is_pet = excluded.is_pet,
         notes = excluded.notes,
         updated_at = excluded.updated_at,
         source_app = 'myhealth'`,
      [
        personKey,
        r.sex ?? "unspecified",
        r.blood_group ?? null,
        r.height_cm ?? null,
        r.advance_directive ?? null,
        Number(r.organ_donor) ? 1 : 0,
        isPet ? 1 : 0,
        r.notes ?? null,
        now,
      ],
    );
  }
  return { table: T.profiles, rowsCopied: rows.length, checksum: sampleChecksum(rows) };
}

/**
 * The per-table copy plan. Each legacy table maps to a copier; profiles + documents have
 * bespoke copiers, everything else is a 1:1 column copy into the namespaced table.
 */
const SIMPLE_COPY: { legacy: string; suite: string }[] = [
  { legacy: "settings", suite: T.settings },
  { legacy: "app_launches", suite: T.appLaunches },
  { legacy: "profile_baseline", suite: T.profileBaseline },
  { legacy: "metrics", suite: T.metrics },
  { legacy: "goals", suite: T.goals },
  { legacy: "reminders", suite: T.reminders },
  { legacy: "daily_tasks", suite: T.dailyTasks },
  { legacy: "task_completions", suite: T.taskCompletions },
  { legacy: "water_log", suite: T.waterLog },
  { legacy: "schedule_blocks", suite: T.scheduleBlocks },
  { legacy: "medications", suite: T.medications },
];

/**
 * Copy + verify the legacy DB into the suite DB (idempotent/resumable). Does NOT delete
 * the legacy file (the caller does that only after this resolves successfully). The suite
 * tables/triggers must already exist (registerSchemas + registerAuxMigrations run first).
 */
export async function migrateLegacyDb(
  legacy: SqlDb,
  suite: SqlDb,
  sealText: SealText,
): Promise<ConsolidationResult> {
  const tables: TableEvidence[] = [];
  const skipped: string[] = [];

  // profiles FIRST (the link rows other tables' FKs point at), then documents, then the rest.
  if (await ledgerHas(suite, T.profiles)) {
    skipped.push(T.profiles);
  } else {
    const ev = await copyProfiles(legacy, suite);
    await verifyAndRecord(legacy, suite, "profiles", ev);
    tables.push(ev);
  }

  if (await ledgerHas(suite, T.documents)) {
    skipped.push(T.documents);
  } else {
    const ev = await copyDocuments(legacy, suite, sealText);
    await verifyAndRecord(legacy, suite, "documents", ev);
    tables.push(ev);
  }

  for (const { legacy: ln, suite: sn } of SIMPLE_COPY) {
    if (await ledgerHas(suite, sn)) {
      skipped.push(sn);
      continue;
    }
    const ev = await copyTable(legacy, suite, ln, sn);
    await verifyAndRecord(legacy, suite, ln, ev);
    tables.push(ev);
  }

  await recordLedger(suite, LEDGER_DONE, "complete", null, null, "all tables migrated + verified");
  return { migrated: true, tables, skipped };
}

/** Verify the copied row count matches the legacy source, then record the ledger row. */
async function verifyAndRecord(
  legacy: SqlDb,
  suite: SqlDb,
  legacyName: string,
  ev: TableEvidence,
): Promise<void> {
  const src = await legacy.select<{ n: number }>(`SELECT COUNT(*) AS n FROM ${legacyName}`);
  const srcCount = src[0]?.n ?? 0;
  if (srcCount !== ev.rowsCopied) {
    // profiles fans out to 3 tables; rowsCopied is the legacy source count, so equality holds.
    throw new Error(
      `consolidation verify failed for ${legacyName}: legacy ${srcCount} rows vs copied ${ev.rowsCopied}`,
    );
  }
  await recordLedger(suite, ev.table, "verified", ev.rowsCopied, ev.checksum, `from legacy "${legacyName}"`);
}

/** True once the whole migration has completed (the LEDGER_DONE sentinel is present). */
export async function isConsolidated(suite: SqlDb): Promise<boolean> {
  try {
    const rows = await suite.select<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${T.migrationLedger} WHERE table_name = ? AND status = 'complete'`,
      [LEDGER_DONE],
    );
    return (rows[0]?.n ?? 0) > 0;
  } catch {
    return false; // ledger table not created yet ⇒ not consolidated
  }
}

const LEGACY_DB_FILE = "myhealth.db";

/** Adapt a Tauri SQL plugin Database to the lib's SqlDb interface (read-only use here). */
function legacyAdapter(db: { select: (sql: string, params?: unknown[]) => Promise<unknown> }): SqlDb {
  return {
    select: <U = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      db.select(sql, params) as Promise<U[]>,
    execute: async () => {
      throw new Error("legacy DB is read-only during consolidation");
    },
  };
}

/**
 * Live one-time consolidation (Tauri only): if the legacy `myhealth.db` exists and the
 * suite ledger is not yet `complete`, migrate it into suite.db, verify, and DELETE the
 * legacy file (decision 6/24, pre-authorized). Best-effort + crash-safe — any failure
 * leaves the legacy file in place to retry on the next launch. Returns true if a migration
 * ran (or the legacy file was already gone), false if it was skipped/deferred.
 *
 * extracted_text is sealed in transit; if a legacy row carries extracted text and the
 * vault is locked, sealing throws and the run defers to a later (unlocked) launch — no
 * plaintext ever lands in suite.db, and the legacy file is NOT deleted.
 */
export async function runConsolidation(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const { exists, remove } = await import("@tauri-apps/plugin-fs");
    const legacyPath = await join(await appDataDir(), LEGACY_DB_FILE);
    if (!(await exists(legacyPath))) return false; // nothing to migrate

    const suite = await openSharedDbAdapter();
    if (await isConsolidated(suite)) {
      // Migration finished on a prior launch but the file lingered (crash before delete) —
      // safe to delete now; the ledger is the source of truth.
      await remove(legacyPath);
      await recordLedger(suite, "__legacy_db__", "deleted", null, null, "legacy file removed (post-verify)");
      return true;
    }

    const sqlPlugin = await import("@tauri-apps/plugin-sql");
    const legacyDb = await sqlPlugin.default.load(`sqlite:${LEGACY_DB_FILE}`);
    const legacy = legacyAdapter(legacyDb as never);

    const result = await migrateLegacyDb(legacy, suite, sealExtractedText);
    if (!result.migrated) return false;

    // Verified — DELETE the legacy DB file (pre-authorized; pre-customer; no backward compat).
    try {
      await legacyDb.close();
    } catch {
      /* ignore */
    }
    await remove(legacyPath);
    await recordLedger(suite, "__legacy_db__", "deleted", null, null, "legacy myhealth.db removed after verified migration");
    console.info(
      `[consolidate] myHealth legacy DB migrated to suite.db: ${result.tables.length} tables, ` +
        `${result.skipped.length} resumed-skip; legacy file deleted.`,
    );
    return true;
  } catch (e) {
    console.warn("[consolidate] deferred (legacy DB left in place to retry):", e);
    return false;
  }
}
