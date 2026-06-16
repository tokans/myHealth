import { describe, it, expect } from "vitest";
import { exportBundle, ingestBundle } from "./transport";
import type { MergeEngine, SyncBundle } from "sharedcorelib/sync";

/** A stub merge engine: emits `out`, and records every bundle handed to `ingest`. */
function fakeEngine(out: SyncBundle): { engine: MergeEngine; received: SyncBundle[] } {
  const received: SyncBundle[] = [];
  const engine: MergeEngine = {
    scope: () => [],
    outgoing: async () => out,
    ingest: async (b) => {
      received.push(b);
      return { applied: Object.keys(b).length, skipped: 0 };
    },
  };
  return { engine, received };
}

const BUNDLE: SyncBundle = {
  "common#Person": [{ person_key: "p1", display_name: "A", updated_at: "2026-01-01T00:00:00Z" }],
};

describe("sync transport (encrypted file round-trip)", () => {
  it("seals an outgoing bundle that the peer opens + merges with the same pairing code", async () => {
    const a = fakeEngine(BUNDLE);
    const bytes = await exportBundle(a.engine, "correct horse battery staple");

    const b = fakeEngine({});
    const result = await ingestBundle(b.engine, bytes, "correct horse battery staple");

    expect(b.received[0]).toEqual(BUNDLE); // decrypted to the exact bundle
    expect(result.applied).toBe(1);
  });

  it("a wrong pairing code cannot open the bundle (AES-GCM tag fails)", async () => {
    const a = fakeEngine(BUNDLE);
    const bytes = await exportBundle(a.engine, "the-right-pairing-code");

    const b = fakeEngine({});
    await expect(ingestBundle(b.engine, bytes, "a-different-code-x")).rejects.toThrow();
    expect(b.received).toHaveLength(0); // nothing merged on failure
  });
});
