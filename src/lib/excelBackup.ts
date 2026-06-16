/**
 * Excel backup/restore wiring (Settings → "Backup & restore").
 *
 * Thin glue over `sharedcorelib/backup` (subsystem #22): exports EVERYTHING this app
 * stores — all of `myhealth.db` plus myHealth's slice of the shared `suite.db` (its
 * owned facet + common spine tables, from the schema registry) — into one .xlsx, one
 * sheet per table, re-importable on another machine. Secret-tier / password-named
 * fields export as one-way sha256 fingerprints and are skipped on import (core rule).
 * Stronghold vault contents (document blobs' keys) are not in SQLite and are never
 * exported; encrypted document BYTES live as vault blobs and are likewise not part of
 * the workbook (only their metadata rows are).
 */
import {
  createExcelBackup, suiteSourceFull,
  type ExcelBackup, type BackupSource,
} from "sharedcorelib/backup";
import { loadRegistry, type SqlDb } from "sharedcorelib/db";
import { getDb } from "@/db/client";
import { openSharedDbAdapter } from "@/db/sharedDb";
import { APP_ID } from "@/db/healthFacet";
import { demoSaveName } from "@/lib/demoMode";

/** Adapt the app's own Tauri-SQL handle (`myhealth.db`) to the lib's `SqlDb`. */
async function appDbAdapter(): Promise<SqlDb> {
  const db = await getDb();
  return {
    select: <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      db.select<T[]>(sql, params),
    execute: async (sql: string, params: unknown[] = []) => {
      const r = await db.execute(sql, params);
      return { rowsAffected: r.rowsAffected, lastInsertId: r.lastInsertId ?? undefined };
    },
  };
}

/** Build the backup engine over both stores. Tauri-only (the app DB throws in browser). */
export async function buildExcelBackup(): Promise<ExcelBackup> {
  const sources: BackupSource[] = [{ id: "app", db: await appDbAdapter() }];
  try {
    // FULL suite dump: every installed app's tables in suite.db (not just ours) — any
    // app's export is the suite-wide data inventory + backup; suite sheets restore
    // from any app's workbook.
    const suite = await openSharedDbAdapter();
    sources.push(suiteSourceFull(suite, await loadRegistry(suite)));
  } catch (e) {
    console.warn("excel backup: shared suite DB unavailable — backing up the app DB alone:", e);
  }
  return createExcelBackup({ appId: APP_ID, sources });
}

/** Native save handler for `BackupPanel` (Tauri dialog + fs). */
export async function saveBackupFile(bytes: Uint8Array, fileName: string): Promise<void> {
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  // Demo mode: skip the native dialog and write to the app-data dir unattended.
  const demoName = demoSaveName(fileName);
  if (demoName) {
    const { BaseDirectory } = await import("@tauri-apps/plugin-fs");
    await writeFile(demoName, bytes, { baseDir: BaseDirectory.AppData });
    return;
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({
    defaultPath: fileName,
    filters: [{ name: "Excel workbook", extensions: ["xlsx"] }],
  });
  if (!path) throw new Error("Export cancelled — no file chosen.");
  await writeFile(path, bytes);
}
