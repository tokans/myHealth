/**
 * Encrypted, device-to-device sync transport — the v1 channel is a FILE the user
 * carries between their devices (USB / AirDrop / shared folder). No server is ever
 * involved (invariant 1).
 *
 * The bundle is sealed with the user's **pairing code** as the passphrase via
 * `sharedcorelib/crypto` (PBKDF2 → AES-256-GCM), so the file is opaque in transit
 * and only the paired device (which knows the same code) can open it. Both devices
 * type the same pairing code.
 *
 * Flow: device A `exportBundle` → `.sync` file → device B `ingestBundle` (merges
 * with last-writer-wins). Repeat the other way for a full two-way sync.
 *
 * FUTURE: a Rust LAN sidecar implementing the lib's `SyncTransport` (the "dumb
 * encrypted-byte pipe") would make this automatic over Wi-Fi; the merge engine +
 * crypto envelope here are exactly what it would carry, so that's an additive swap.
 */
import { encryptJson, decryptJson } from "sharedcorelib/crypto";
import type { MergeEngine, SyncBundle, ApplyResult } from "sharedcorelib/sync";

/** Bound as AES-GCM AAD so a file from another app/purpose can't be opened as a myHealth sync. */
const SYNC_AAD = "myhealth-sync-v1";

/** This device's outgoing bundle, sealed with the pairing code. Hand the bytes to the peer. */
export async function exportBundle(engine: MergeEngine, pairingCode: string): Promise<Uint8Array> {
  const bundle = await engine.outgoing();
  return encryptJson(bundle, pairingCode, { aad: SYNC_AAD });
}

/**
 * Open a peer's sealed bundle with the shared pairing code and merge it (LWW).
 * Throws if the pairing code is wrong or the file is corrupt/foreign (the AES-GCM
 * tag fails), so the caller can show "wrong code / not a sync file".
 */
export async function ingestBundle(
  engine: MergeEngine,
  bytes: Uint8Array,
  pairingCode: string,
): Promise<ApplyResult> {
  const bundle = await decryptJson<SyncBundle>(bytes, pairingCode, { aad: SYNC_AAD });
  return engine.ingest(bundle);
}

/** Save a sealed bundle to a `.sync` file the user moves to the other device (Tauri). */
export async function saveSyncFile(bytes: Uint8Array, fileName: string): Promise<void> {
  const { saveBytesToFile } = await import("@/lib/fileSave");
  await saveBytesToFile(bytes, fileName, [{ name: "myHealth sync", extensions: ["sync"] }]);
}

/** Pick a peer's `.sync` file and read its bytes; null if the user cancels (Tauri). */
export async function openSyncFile(): Promise<Uint8Array | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const path = await open({
    multiple: false,
    filters: [{ name: "myHealth sync", extensions: ["sync"] }],
  });
  if (!path || typeof path !== "string") return null;
  return await readFile(path);
}
