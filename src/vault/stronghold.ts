/**
 * myHealth's single app-level encrypted vault (Stronghold + per-device document
 * key). The Argon2 snapshot-key salt/params live in src-tauri/src/lib.rs and must
 * never change (see CONTRACT.md §3). Used later for encrypted medical documents.
 */
import { createVault, type Credential } from "sharedcorelib/vault";

export type { Credential };

export const vault = createVault({
  clientName: "myhealth",
  snapshotFile: "vault.stronghold",
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
