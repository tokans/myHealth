import { describe, it, expect } from "vitest";
import { createLocalRecoveryBlobStore, createHealthRecovery } from "./recovery";

function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  } as Pick<Storage, "getItem" | "setItem" | "removeItem">;
}

describe("layered recovery (free, offline floor)", () => {
  it("enroll → recover round-trips the master key with the Recovery Key", async () => {
    const blobStore = createLocalRecoveryBlobStore(memStorage());
    const recovery = createHealthRecovery({ blobStore });
    const mk = crypto.getRandomValues(new Uint8Array(32));
    const { recoveryKey } = await recovery.enroll(mk);
    expect(recoveryKey).toBeTruthy();
    const recovered = await recovery.recover(recoveryKey);
    expect(Array.from(recovered)).toEqual(Array.from(mk));
  });

  it("a wrong Recovery Key fails to recover (blob is opaque ciphertext)", async () => {
    const recovery = createHealthRecovery({ blobStore: createLocalRecoveryBlobStore(memStorage()) });
    const mk = crypto.getRandomValues(new Uint8Array(32));
    await recovery.enroll(mk);
    await expect(recovery.recover("WRONG-WRONG-WRONG-WRONG")).rejects.toBeTruthy();
  });

  it("rekey rotates the RK; the OLD key no longer opens the current blob (forward protection)", async () => {
    const blobStore = createLocalRecoveryBlobStore(memStorage());
    const recovery = createHealthRecovery({ blobStore });
    const mk = crypto.getRandomValues(new Uint8Array(32));
    const { recoveryKey: oldRk } = await recovery.enroll(mk);
    const { recoveryKey: newRk } = await recovery.rekey(mk);
    expect(newRk).not.toBe(oldRk);
    expect(Array.from(await recovery.recover(newRk))).toEqual(Array.from(mk));
    await expect(recovery.recover(oldRk)).rejects.toBeTruthy();
  });

  it("pushes only CIPHERTEXT to escrow (registered tier) — server never sees the RK", async () => {
    let pushed: Uint8Array | null = null;
    const escrow = {
      push: async (blob: Uint8Array) => void (pushed = blob),
      pull: async () => pushed,
    };
    const recovery = createHealthRecovery({ blobStore: createLocalRecoveryBlobStore(memStorage()), escrow });
    const mk = crypto.getRandomValues(new Uint8Array(32));
    const { recoveryKey } = await recovery.enroll(mk);
    await recovery.backupToEscrow();
    expect(pushed).toBeTruthy();
    // the escrowed blob is NOT the recovery key (it is opaque wrapped ciphertext)
    expect(new TextDecoder().decode(pushed!)).not.toContain(recoveryKey);
  });
});
