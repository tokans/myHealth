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
 */
import { createExcelBackup, suiteSourceFull, type ExcelBackup } from "sharedcorelib/backup";
import { loadRegistry } from "sharedcorelib/db";
import { openSharedDbAdapter } from "@/db/sharedDb";
import { APP_ID } from "@/db/healthFacet";
import { demoSaveName } from "@/lib/demoMode";

/** Build the backup engine over the single suite source. Tauri-only. */
export async function buildExcelBackup(): Promise<ExcelBackup> {
  // FULL suite dump: every installed app's tables in suite.db (not just ours) — any app's
  // export is the suite-wide data inventory + backup; suite sheets restore from any app's
  // workbook.
  const suite = await openSharedDbAdapter();
  const sources = [suiteSourceFull(suite, await loadRegistry(suite))];
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
