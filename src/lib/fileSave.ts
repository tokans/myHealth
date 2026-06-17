/**
 * Native "save bytes to a user-chosen file" helper — shared by the Excel backup, the
 * per-tab Excel export, and the device-sync `.sync` writer.
 *
 * The app's filesystem capability is scoped to the user's standard document roots —
 * Desktop, Documents, Downloads — plus its own data dirs (see
 * `src-tauri/capabilities/default.json`; the broad `$HOME/**` grant was removed so the
 * app can't read/write dotfiles, .ssh, browser profiles, etc.). To keep saving smooth
 * within that scope we:
 *   1. default the save dialog to the Documents folder (always writable), and
 *   2. if the user navigates OUTSIDE the allowed roots and the OS write is denied,
 *      rethrow a clear message naming the folders instead of a cryptic fs error.
 */

/** The folders the app is permitted to write to (matches the fs capability scope). */
export const SAVE_FOLDERS_HINT =
  "You can only save to your Desktop, Documents, or Downloads folder.";

/**
 * Show the native save dialog (defaulting to Documents) and write `bytes` to the chosen
 * path. Throws "Save cancelled…" if the user dismisses the dialog, or a folder-scope
 * hint if the write is denied because the chosen location is outside the allowed roots.
 * Tauri-only (the callers gate on `isTauri()` / demo mode before reaching here).
 */
export async function saveBytesToFile(
  bytes: Uint8Array,
  fileName: string,
  filters?: { name: string; extensions: string[] }[],
): Promise<void> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeFile } = await import("@tauri-apps/plugin-fs");

  // Default to the Documents folder so the dialog opens somewhere we're allowed to write.
  let defaultPath = fileName;
  try {
    const { documentDir, join } = await import("@tauri-apps/api/path");
    defaultPath = await join(await documentDir(), fileName);
  } catch {
    /* path API unavailable — fall back to a bare filename */
  }

  const path = await save({ defaultPath, filters });
  if (!path) throw new Error("Save cancelled — no file chosen.");

  try {
    await writeFile(path, bytes);
  } catch (e) {
    // Most likely the chosen folder is outside the app's allowed scope.
    throw new Error(`Couldn't save to that location. ${SAVE_FOLDERS_HINT}`, { cause: e });
  }
}
