import { describe, it, expect } from "vitest";
import { detectOpenMed, shouldNudgeOpenMed, STUB_PROBE } from "./openmed";

describe("OpenMed capability detection (Phase 4 stub)", () => {
  it("default stub reports the sidecar absent — free path stays the only path", async () => {
    const cap = await detectOpenMed();
    expect(cap.sidecarPresent).toBe(false);
    expect(cap.entitled).toBe(false);
    expect(cap.available).toBe(false);
  });

  it("STUB_PROBE never claims a sidecar (no network, no health egress)", async () => {
    expect(await STUB_PROBE.detectSidecar()).toBe(false);
    expect(await STUB_PROBE.hasEntitlement()).toBe(false);
  });

  it("double-gate: needs BOTH sidecar AND entitlement to become available", async () => {
    expect((await detectOpenMed({ detectSidecar: () => true, hasEntitlement: () => false })).available).toBe(false);
    expect((await detectOpenMed({ detectSidecar: () => false, hasEntitlement: () => true })).available).toBe(false);
    expect((await detectOpenMed({ detectSidecar: () => true, hasEntitlement: () => true })).available).toBe(true);
  });

  it("nudges to myLifeAssistant only when smarter extraction is NOT available", () => {
    expect(shouldNudgeOpenMed({ sidecarPresent: false, entitled: false, available: false })).toBe(true);
    expect(shouldNudgeOpenMed({ sidecarPresent: true, entitled: true, available: true })).toBe(false);
  });
});
