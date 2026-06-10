/**
 * Layered recovery wiring (Stage C prompt 04 Phase 5) — adopts `sharedcorelib/recovery`.
 *
 * The recovery model is layered:
 *   - FREE, offline floor (no account): a high-entropy Recovery Key wraps the master key;
 *     the wrapped blob lives on-device next to the vault (`RecoveryBlobStore`). This is the
 *     safety minimum and stays free + login-less — never paywalled (suite invariant 3).
 *   - REGISTERED tier (optional): the SAME wrapped blob can be pushed to zero-knowledge
 *     escrow as CIPHERTEXT. The server stores a blob it cannot decrypt; the RK never leaves
 *     the device (suite invariant 2 — no vendor backdoor).
 *
 * Crypto is entirely core's (`createRecovery`); this module just supplies myHealth's blob
 * store + optional escrow client via DI. No health data is involved — only the wrapped
 * master key (opaque ciphertext) moves, and only the local blob on the free path.
 */
import { createRecovery, type Recovery, type RecoveryBlobStore, type EscrowClient, type WrappedKey } from "sharedcorelib/recovery";

const RK_BLOB_KEY = "myhealth.recovery.wrappedMK";

/**
 * A localStorage-backed wrapped-key blob store for browser/preview + a default on-device
 * floor. In Tauri the live wiring would persist next to the vault snapshot; the shape is
 * the same. Storage is injected for testability.
 */
export function createLocalRecoveryBlobStore(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage,
): RecoveryBlobStore {
  return {
    async save(blob: WrappedKey) {
      storage.setItem(RK_BLOB_KEY, btoa(String.fromCharCode(...blob)));
    },
    async load() {
      const raw = storage.getItem(RK_BLOB_KEY);
      if (!raw) return null;
      return Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    },
    async clear() {
      storage.removeItem(RK_BLOB_KEY);
    },
  };
}

/**
 * Build myHealth's recovery handle. Pass an `escrow` only for registered-tier users; on the
 * free, offline path omit it (the local blob store is the floor). The returned `Recovery`
 * exposes enroll / recover / rekey / backupToEscrow from core.
 */
export function createHealthRecovery(opts?: {
  blobStore?: RecoveryBlobStore;
  escrow?: EscrowClient;
}): Recovery {
  return createRecovery({
    blobStore: opts?.blobStore ?? createLocalRecoveryBlobStore(),
    escrow: opts?.escrow,
  });
}
