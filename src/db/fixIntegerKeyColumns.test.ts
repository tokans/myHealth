import { describe, it, expect } from "vitest";
import type { SqlDb } from "sharedcorelib/db";
import { registerSchemas, registerAuxMigrations } from "sharedcorelib/db";
import { fixIntegerKeyColumns, dedupeProfileLinks } from "./fixIntegerKeyColumns";
import { APP_TABLE_SCHEMAS } from "./appTables";
import { MYHEALTH_AUX_MIGRATIONS } from "./auxMigrations";
import { APP_ID } from "./healthFacet";
import { T } from "./tables";

/**
 * `fixIntegerKeyColumns` repairs real SQLite type/ROWID semantics (a `REAL`-vs-`INTEGER`
 * primary key affects whether SQLite auto-populates it on INSERT) — a hand-rolled SQL-
 * string-matching fake DB can't exercise that meaningfully, so this test runs against a
 * real engine: Node 22.5+'s builtin `node:sqlite`. Skipped gracefully on older Node (e.g.
 * CI pinned to Node 20) rather than failing the suite.
 */
let DatabaseSyncCtor: (new (location: string) => InstanceType<typeof import("node:sqlite").DatabaseSync>) | null = null;
try {
  ({ DatabaseSync: DatabaseSyncCtor } = await import("node:sqlite"));
} catch {
  /* node:sqlite unavailable on this Node — the suite below is skipped */
}

function realDb(Ctor: NonNullable<typeof DatabaseSyncCtor>) {
  const db = new Ctor(":memory:");
  const sql: SqlDb = {
    select: async (s, p = []) => db.prepare(s).all(...(p as never[])) as never,
    execute: async (s, p = []) => {
      const info = db.prepare(s).run(...(p as never[]));
      return { rowsAffected: Number(info.changes), lastInsertId: Number(info.lastInsertRowid) };
    },
  };
  return { db, sql };
}

describe.skipIf(!DatabaseSyncCtor)("fixIntegerKeyColumns (real SQLite)", () => {
  it("recreates a pre-fix REAL-id table as INTEGER, re-keys rows by ROWID, and heals dropped indexes/triggers", async () => {
    const { db, sql } = realDb(DatabaseSyncCtor!);

    // Simulate an already-existing pre-fix suite.db: myhealth_profiles created with the
    // OLD (buggy) DDL shape, holding both a "good" seeded row (an explicit non-null id,
    // unrelated to ROWID) and orphaned rows from failed create attempts (id always NULL —
    // the exact bug this whole migration exists to repair).
    db.exec(`CREATE TABLE "myhealth_profiles" (
      "id" REAL, "person_key" TEXT NOT NULL, "photo_ref" TEXT,
      "emergency_contact" TEXT, "created_at" TEXT, PRIMARY KEY ("id")
    )`);
    db.prepare(`INSERT INTO myhealth_profiles (id, person_key, created_at) VALUES (748, 'self', '2026-06-16')`).run();
    db.prepare(`INSERT INTO myhealth_profiles (person_key, created_at) VALUES ('__pending__x', '2026-06-26')`).run();

    await registerSchemas(sql, APP_TABLE_SCHEMAS); // every OTHER table is "brand new" here
    const result = await fixIntegerKeyColumns(sql, APP_TABLE_SCHEMAS);
    expect(result.fixed).toContain(T.profiles);

    const schemaSql = db.prepare("SELECT sql FROM sqlite_master WHERE name=?").get(T.profiles) as { sql: string };
    expect(schemaSql.sql).toMatch(/"id" INTEGER/);

    const rows = db.prepare(`SELECT * FROM ${T.profiles} ORDER BY id`).all() as { id: number; person_key: string }[];
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => typeof r.id === "number" && r.id > 0)).toBe(true);
    expect(rows.map((r) => r.person_key).sort()).toEqual(["__pending__x", "self"]);

    // The cascade-delete trigger from auxMigrations v1 must have been dropped along with
    // the old table — confirm it's gone before v3 heals it below.
    const triggerBefore = db
      .prepare("SELECT name FROM sqlite_master WHERE tbl_name=? AND type='trigger'")
      .all(T.profiles);
    expect(triggerBefore).toHaveLength(0);

    await registerAuxMigrations(sql, APP_ID, MYHEALTH_AUX_MIGRATIONS);
    const triggerAfter = db
      .prepare("SELECT name FROM sqlite_master WHERE tbl_name=? AND type='trigger'")
      .all(T.profiles) as { name: string }[];
    expect(triggerAfter.map((t) => t.name)).toContain("trg_myhealth_profiles_delete");

    // A NEW insert after the fix must actually round-trip via lastInsertId — the entire
    // point of the migration.
    const linkRes = await sql.execute(`INSERT INTO ${T.profiles} (person_key, created_at) VALUES (?, ?)`, [
      "mhp-new",
      "2026-06-26",
    ]);
    const updRes = await sql.execute(`UPDATE ${T.profiles} SET person_key = ? WHERE id = ?`, [
      "mhp-new-confirmed",
      linkRes.lastInsertId,
    ]);
    expect(updRes.rowsAffected).toBe(1);
  });

  it("is a no-op for a table whose id is already INTEGER, and for tables that don't exist yet", async () => {
    const { db, sql } = realDb(DatabaseSyncCtor!);
    await registerSchemas(sql, APP_TABLE_SCHEMAS); // every table created fresh, already correct
    const before = db.prepare(`SELECT * FROM ${T.profiles}`).all();
    const result = await fixIntegerKeyColumns(sql, APP_TABLE_SCHEMAS);
    expect(result.fixed).toEqual([]);
    expect(db.prepare(`SELECT * FROM ${T.profiles}`).all()).toEqual(before);
  });

  it("running the boot sequence twice in a row is idempotent (no errors, no data loss)", async () => {
    const { db, sql } = realDb(DatabaseSyncCtor!);
    db.exec(`CREATE TABLE "myhealth_goals" (
      "id" REAL, "profile_id" REAL, "kind" TEXT NOT NULL, "title" TEXT NOT NULL,
      "metric_kind" TEXT, "baseline" REAL, "target" REAL, "unit" TEXT, "direction" TEXT,
      "target_date" TEXT, "status" TEXT NOT NULL, "created_at" TEXT, "archived_at" TEXT,
      PRIMARY KEY ("id")
    )`);
    db.prepare(`INSERT INTO myhealth_goals (profile_id, kind, title, status) VALUES (1, 'weight', 'Lose 5kg', 'active')`).run();

    await registerSchemas(sql, APP_TABLE_SCHEMAS);
    await fixIntegerKeyColumns(sql, APP_TABLE_SCHEMAS);
    await registerAuxMigrations(sql, APP_ID, MYHEALTH_AUX_MIGRATIONS);
    const afterFirst = db.prepare(`SELECT * FROM ${T.goals}`).all();

    await registerSchemas(sql, APP_TABLE_SCHEMAS);
    const secondFix = await fixIntegerKeyColumns(sql, APP_TABLE_SCHEMAS);
    await registerAuxMigrations(sql, APP_ID, MYHEALTH_AUX_MIGRATIONS);
    expect(secondFix.fixed).toEqual([]);
    expect(db.prepare(`SELECT * FROM ${T.goals}`).all()).toEqual(afterFirst);
  });
});

describe.skipIf(!DatabaseSyncCtor)("dedupeProfileLinks (real SQLite)", () => {
  it("collapses duplicate person_key rows onto the lowest id and repoints child profile_id references", async () => {
    const { db, sql } = realDb(DatabaseSyncCtor!);
    await registerSchemas(sql, APP_TABLE_SCHEMAS);
    // Simulate the corrupted state that let the duplicate in: the person_key UNIQUE
    // index missing (dropped by a racing fixIntegerKeyColumns pass, in the wild) — this
    // repair runs BEFORE registerAuxMigrations re-creates it, so it must tolerate that.
    db.exec(`DROP INDEX "ix_myhealth_profiles_person_key"`);

    // Two myhealth_profiles rows both pointing at person_key='self' — the exact
    // corruption a missing UNIQUE INDEX let through. id=2 is the "older" duplicate
    // (lower id, kept); id=5 is the "newer" one (higher id, removed).
    db.prepare(`INSERT INTO ${T.profiles} (id, person_key, created_at) VALUES (2, 'self', '2026-06-16')`).run();
    db.prepare(`INSERT INTO ${T.profiles} (id, person_key, created_at) VALUES (5, 'self', '2026-06-26')`).run();
    db.prepare(`INSERT INTO ${T.profiles} (id, person_key, created_at) VALUES (3, 'mhp-3', '2026-06-16')`).run();
    // A logged metric against the duplicate (higher) id that must NOT be orphaned.
    db.prepare(
      `INSERT INTO ${T.metrics} (profile_id, kind, value, taken_at, source) VALUES (5, 'weight', 72.5, '2026-06-26', 'manual')`,
    ).run();
    db.prepare(
      `INSERT INTO ${T.metrics} (profile_id, kind, value, taken_at, source) VALUES (3, 'weight', 60, '2026-06-26', 'manual')`,
    ).run();

    const result = await dedupeProfileLinks(sql, APP_TABLE_SCHEMAS);
    expect(result.collapsed).toBe(1);

    const profiles = db.prepare(`SELECT id, person_key FROM ${T.profiles} ORDER BY id`).all();
    expect(profiles).toEqual([
      { id: 2, person_key: "self" },
      { id: 3, person_key: "mhp-3" },
    ]);

    const metrics = db.prepare(`SELECT profile_id, value FROM ${T.metrics} ORDER BY value`).all();
    // The metric that pointed at the removed duplicate (5) now points at the survivor (2);
    // the unrelated profile's metric (3) is untouched.
    expect(metrics).toEqual([
      { profile_id: 3, value: 60 },
      { profile_id: 2, value: 72.5 },
    ]);
  });

  it("is a no-op when there are no duplicates", async () => {
    const { db, sql } = realDb(DatabaseSyncCtor!);
    await registerSchemas(sql, APP_TABLE_SCHEMAS);
    db.prepare(`INSERT INTO ${T.profiles} (id, person_key, created_at) VALUES (1, 'self', '2026-06-16')`).run();

    const before = db.prepare(`SELECT * FROM ${T.profiles}`).all();
    const result = await dedupeProfileLinks(sql, APP_TABLE_SCHEMAS);
    expect(result.collapsed).toBe(0);
    expect(db.prepare(`SELECT * FROM ${T.profiles}`).all()).toEqual(before);
  });
});
