import { describe, it, expect, vi, beforeEach } from "vitest";

// A fake AES-GCM: seal prepends the AAD + a marker so we can assert AAD binding and that
// the output is not the plaintext; open verifies the AAD and strips the marker.
const sealed = new Map<string, Uint8Array>();
vi.mock("@/vault/stronghold", () => ({
  sealBytes: vi.fn(async (plain: Uint8Array, aad?: string) => {
    const tag = new TextEncoder().encode(`[${aad}]`);
    const out = new Uint8Array(tag.length + plain.length);
    out.set(tag, 0);
    out.set(plain, tag.length);
    return out;
  }),
  openBytes: vi.fn(async (bytes: Uint8Array, aad?: string) => {
    const tag = new TextEncoder().encode(`[${aad}]`);
    const prefix = bytes.slice(0, tag.length);
    if (new TextDecoder().decode(prefix) !== `[${aad}]`) throw new Error("AAD mismatch");
    return bytes.slice(tag.length);
  }),
}));

import { sealExtractedText, openExtractedText, isSealedText } from "./sealedText";

beforeEach(() => sealed.clear());

describe("sealExtractedText / openExtractedText", () => {
  it("round-trips plaintext through the vault primitive", async () => {
    const enc = await sealExtractedText("WBC 6.1, Hb 13", "blob-1");
    expect(enc).toMatch(/^scv1:/);
    expect(enc).not.toContain("WBC"); // base64 of sealed bytes, never plaintext
    expect(isSealedText(enc)).toBe(true);

    const back = await openExtractedText(enc, "blob-1");
    expect(back).toBe("WBC 6.1, Hb 13");
  });

  it("binds ciphertext to the document blob via AAD (wrong AAD fails to open)", async () => {
    const enc = await sealExtractedText("secret", "blob-A");
    await expect(openExtractedText(enc, "blob-B")).rejects.toThrow(/AAD/);
  });

  it("returns null for empty/absent input", async () => {
    expect(await sealExtractedText(null, "x")).toBeNull();
    expect(await sealExtractedText("", "x")).toBeNull();
    expect(await openExtractedText(null, "x")).toBeNull();
  });

  it("passes legacy plaintext through unchanged on open (graceful degrade)", async () => {
    expect(isSealedText("just text")).toBe(false);
    expect(await openExtractedText("just text", "x")).toBe("just text");
  });
});
