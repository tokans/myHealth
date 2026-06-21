/**
 * Excel backup/restore wiring (Settings → "Backup & restore").
 *
 * Thin glue over `sharedcorelib/backup` (subsystem #22). Post-consolidation (prompts/10
 * decisions 1 & 9) there is a SINGLE source: the FULL `suite.db` dump — every installed
 * app's tables, one sheet per table, re-importable on another machine. The per-app
 * `myhealth.db` is gone, so there is no separate "app" source any more. Secret-tier /
 * password-named fields (e.g. the sealed `extracted_text_enc`) export as one-way sha256
 * fingerprints and are skipped on import (core rule). Stronghold vault contents and
 * encrypted document BYTES are not in SQLite and are never exported (only metadata rows).
 *
 * Both the build (`buildSuiteBackup`) and the native save (`saveBackupBytes`) now come from
 * the shared core; the byte-identical local glue was removed. The exported names are kept so
 * `BackupPanel`/Settings resolve unchanged. The only app-side wrinkle preserved is demo mode
 * (an unattended AppData write that skips the OS dialog) — dev-only, constant-folds away.
 */
import { buildSuiteBackup, saveBackupBytes, type ExcelBackup } from "sharedcorelib/backup";
import { openSharedDbAdapter } from "@/db/sharedDb";
import { APP_ID } from "@/db/healthFacet";
import { demoSaveName } from "@/lib/demoMode";

/** Build the whole-suite backup engine over the shared suite DB. Tauri-only. */
export function buildExcelBackup(): Promise<ExcelBackup> {
  return buildSuiteBackup({ appId: APP_ID, openDb: openSharedDbAdapter });
}

/** Native save handler for `BackupPanel` (Tauri dialog + fs), via the shared core. */
export async function saveBackupFile(bytes: Uint8Array, fileName: string): Promise<void> {
  // Demo mode: skip the native dialog and write to the app-data dir unattended.
  const demoName = demoSaveName(fileName);
  if (demoName) {
    const { writeFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    await writeFile(demoName, bytes, { baseDir: BaseDirectory.AppData });
    return;
  }
  await saveBackupBytes(bytes, fileName);
}
