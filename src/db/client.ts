/**
 * Lazy SQLite client over the Tauri SQL plugin, now bound to the ONE shared suite DB
 * (`<shared core>/db/suite.db`, path from the `shared_core_db_path` Tauri command). The
 * per-app `myhealth.db` is retired (K1 consolidation, prompts/10 decision 1): every
 * myHealth table is an app-owned namespaced `myhealth_*` table in suite.db.
 *
 * `getDb()` throws outside Tauri — pages must gate Tauri-only paths with `isTauri()`
 * (see @/lib/environment).
 */
import type Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/environment";

let dbPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (!isTauri()) {
    throw new Error("Database is only available inside the desktop app.");
  }
  if (!dbPromise) {
    dbPromise = (async () => {
      const m = await import("@tauri-apps/plugin-sql");
      const path = await invoke<string>("shared_core_db_path");
      return m.default.load(`sqlite:${path}`);
    })();
  }
  return dbPromise;
}

/** Run a SELECT and return typed rows. */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(sql, params);
}

/** Run an INSERT/UPDATE/DELETE; returns last insert id + rows affected. */
export async function execute(sql: string, params: unknown[] = []) {
  const db = await getDb();
  return db.execute(sql, params);
}
