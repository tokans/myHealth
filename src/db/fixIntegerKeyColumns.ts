/**
 * One-time, idempotent repair for a now-fixed core bug (sharedcorelib/db `createTableSql`
 * used to emit `REAL` for every `dataType: "number"` keyField — including the app-side
 * auto-incrementing integer `id` every `myhealth_*` table uses via `idField()` in
 * appTables.ts). SQLite only aliases a PRIMARY KEY column to the auto-incrementing ROWID
 * when its declared type is the literal `INTEGER`; with `REAL` the column silently stayed
 * NULL on every insert forever. The core fix only affects NEW table creation
 * (`CREATE TABLE IF NOT EXISTS` is a no-op against an already-existing table) — any
 * suite.db created before the fix keeps the broken `REAL` schema until this runs.
 *
 * Runs once per affected table, detected live via `PRAGMA table_info` (no separate ledger
 * needed — once a table's `id` column is `INTEGER` there is nothing left to do, so re-runs
 * are cheap no-ops). Recreates the table under its current (fixed) descriptor and
 * re-populates every row's `id` from its SQLite ROWID — the only value that was ever
 * actually unique and assigned per row, since the broken `id` column itself was NULL for
 * every app-inserted row (any non-null `id` seen, e.g. from the dev seeder, was an
 * explicit literal unrelated to ROWID, so it is intentionally NOT preserved — there is no
 * reliable "real" id to keep once the column was broken). Crash-safe/resumable: a stable
 * (not timestamped) temp table name lets a re-run pick up a previous interrupted attempt.
 *
 * Dropping + recreating a table also drops any indexes/triggers aux-SQL had attached to
 * it; `auxMigrations.ts` v3 re-asserts v1+v2's `CREATE INDEX/TRIGGER IF NOT EXISTS`
 * statements to heal that — this function MUST run before `registerAuxMigrations` so v3
 * has something to heal.
 */
import type { SchemaDescriptor, FieldDescriptor } from "sharedcorelib/schema";
import { createTableSql, type SqlDb } from "sharedcorelib/db";

const TEMP_SUFFIX = "__fix_int_id_v1";

function soleNumericKeyField(s: SchemaDescriptor): FieldDescriptor | null {
  const keys = s.fields.filter((f) => f.keyField);
  return keys.length === 1 && keys[0]!.dataType === "number" ? keys[0]! : null;
}

function colName(f: FieldDescriptor): string {
  return f.dbAlias ?? f.name;
}

async function declaredIdType(db: SqlDb, table: string): Promise<string | null> {
  const rows = await db.select<{ name: string; type: string }>(`PRAGMA table_info("${table}")`);
  return rows.find((r) => r.name === "id")?.type ?? null;
}

async function tableExists(db: SqlDb, table: string): Promise<boolean> {
  const rows = await db.select<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [table],
  );
  return (rows[0]?.n ?? 0) > 0;
}

/** Recreate one table with the correct `id INTEGER` schema, re-keying every row by ROWID. */
async function fixTable(db: SqlDb, schema: SchemaDescriptor, table: string, idField: FieldDescriptor): Promise<void> {
  const tmp = `${table}${TEMP_SUFFIX}`;
  const cols = schema.fields.map(colName);
  const idCol = colName(idField);
  const selectCols = cols.map((c) => (c === idCol ? "rowid" : c)).join(", ");

  if (!(await tableExists(db, tmp))) {
    // Common path: no prior interrupted attempt — stash the broken table under the temp name.
    await db.execute(`ALTER TABLE "${table}" RENAME TO "${tmp}"`);
    for (const stmt of createTableSql(schema)) await db.execute(stmt);
  } else if (!(await tableExists(db, table))) {
    // Resumed after a crash between the rename and the recreate — finish the recreate.
    for (const stmt of createTableSql(schema)) await db.execute(stmt);
  }
  // else: resumed after the recreate but before the copy/drop below — both tables exist,
  // `table` already has the fixed (and still empty, since the copy never ran) schema.

  await db.execute(
    `INSERT OR IGNORE INTO "${table}" (${cols.join(", ")}) SELECT ${selectCols} FROM "${tmp}"`,
  );
  await db.execute(`DROP TABLE "${tmp}"`);
}

export interface FixResult {
  /** Tables whose `id` column was REAL and have been recreated as INTEGER. */
  fixed: string[];
}

/**
 * Check every schema with a sole numeric keyField and repair any whose physical table
 * still has the pre-fix `REAL` column type. Pure/DI over an injected {@link SqlDb} so it's
 * unit-testable against a real SQLite engine; safe no-op for tables that don't exist yet
 * (a brand-new install) or are already fixed.
 */
export async function fixIntegerKeyColumns(db: SqlDb, schemas: SchemaDescriptor[]): Promise<FixResult> {
  const fixed: string[] = [];
  for (const schema of schemas) {
    const idField = soleNumericKeyField(schema);
    if (!idField) continue;
    const table = (schema as { dbAlias?: string }).dbAlias ?? `${schema.namespace}_${schema.name}`;
    const type = await declaredIdType(db, table);
    if (type === null || type.toUpperCase() === "INTEGER") continue; // missing or already fixed
    await fixTable(db, schema, table, idField);
    fixed.push(table);
  }
  return { fixed };
}

/** Physical name of a schema, mirroring sharedcorelib/db's own `tableName()` convention. */
function physicalName(s: SchemaDescriptor): string {
  return (s as { dbAlias?: string }).dbAlias ?? `${s.namespace}_${s.name}`;
}

/**
 * One-time repair for a duplicate-row corruption observed in the wild: before
 * `initSharedDb` (sharedDb.ts) was made re-entrant-safe, two concurrent boot passes
 * (React StrictMode double-invokes effects in dev) could race inside
 * {@link fixIntegerKeyColumns}'s destructive rename+recreate and leave the table missing
 * its `person_key` UNIQUE index for a window — long enough for `createProfile`'s
 * insert-then-`UPDATE … WHERE id = ?` to land two `myhealth_profiles` rows pointing at the
 * SAME `person_key` (visibly: the same person listed twice in Profiles/the drawer).
 *
 * Idempotent and cheap to re-check (a `GROUP BY … HAVING n > 1`, normally zero rows):
 * collapses every duplicate set onto its lowest id, first repointing every child table's
 * `profile_id` so no logged data (metrics, goals, …) is orphaned by the row it pointed at
 * being removed.
 */
export async function dedupeProfileLinks(db: SqlDb, childSchemas: SchemaDescriptor[] = []): Promise<{ collapsed: number }> {
  const profiles = "myhealth_profiles";
  const dupes = await db.select<{ person_key: string }>(
    `SELECT person_key FROM "${profiles}" GROUP BY person_key HAVING COUNT(*) > 1`,
  );
  if (!dupes.length) return { collapsed: 0 };

  const childTables = childSchemas
    .filter((s) => s.fields.some((f) => f.name === "profile_id"))
    .map(physicalName);

  for (const t of childTables) {
    await db.execute(
      `UPDATE "${t}" SET profile_id = (
         SELECT MIN(w.id) FROM "${profiles}" w
         WHERE w.person_key = (SELECT l.person_key FROM "${profiles}" l WHERE l.id = "${t}".profile_id)
       )
       WHERE profile_id IN (
         SELECT p.id FROM "${profiles}" p
         WHERE p.id <> (SELECT MIN(p2.id) FROM "${profiles}" p2 WHERE p2.person_key = p.person_key)
       )`,
    );
  }
  await db.execute(
    `DELETE FROM "${profiles}"
       WHERE id <> (SELECT MIN(p2.id) FROM "${profiles}" p2 WHERE p2.person_key = "${profiles}".person_key)`,
  );
  return { collapsed: dupes.length };
}
