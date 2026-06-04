/**
 * Lazy SQLite client over the Tauri SQL plugin. `getDb()` throws outside Tauri —
 * pages must gate Tauri-only paths with `isTauri()` (see @/lib/environment).
 */
import type Database from "@tauri-apps/plugin-sql";
import { isTauri } from "@/lib/environment";

let dbPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (!isTauri()) {
    throw new Error("Database is only available inside the desktop app.");
  }
  if (!dbPromise) {
    dbPromise = import("@tauri-apps/plugin-sql").then((m) => m.default.load("sqlite:myhealth.db"));
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
