/**
 * myHealth's single app-level encrypted vault (Stronghold + per-device document
 * key). The Argon2 snapshot-key salt/params live in src-tauri/src/lib.rs and must
 * never change (see CONTRACT.md §3). Used later for encrypted medical documents.
 */
import { createVault, type Credential } from "sharedcorelib/vault";
import { isTauri } from "@/lib/environment";

export type { Credential };

const SNAPSHOT_FILE = "vault.stronghold";

/** Whether a vault snapshot already exists (i.e. a master password was set). */
export async function vaultExists(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const { exists } = await import("@tauri-apps/plugin-fs");
    return await exists(await join(await appDataDir(), SNAPSHOT_FILE));
  } catch {
    return false;
  }
}

export const vault = createVault({
  clientName: "myhealth",
  snapshotFile: SNAPSHOT_FILE,
  // docKeyRecord defaults to "doc-master-key-v1", documentsSubdir to "documents".
});

export const {
  unlock,
  isUnlocked,
  lock,
  saveSnapshot,
  putCredential,
  getCredential,
  removeCredential,
  newCredentialKey,
  sealBytes,
  openBytes,
  saveBlob,
  readBlob,
  deleteBlob,
} = vault;
