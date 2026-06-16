import { describe, it, expect, beforeEach } from "vitest";
import {
  healthGrantSchema,
  grantStatus,
  applyGrant,
  clearGrant,
  grantConfigured,
  importGrantFromFile,
  NO_GRANT,
} from "./receiver";

beforeEach(() => {
  clearGrant();
});

describe("healthGrantSchema", () => {
  it("accepts patron/partner v1 payloads and passes extra fields through", () => {
    expect(healthGrantSchema.parse({ v: 1, kind: "patron", extra: "x" })).toMatchObject({
      v: 1,
      kind: "patron",
      extra: "x",
    });
    expect(healthGrantSchema.parse({ v: 1, kind: "partner" }).kind).toBe("partner");
  });

  it("rejects an unknown kind or version", () => {
    expect(() => healthGrantSchema.parse({ v: 1, kind: "vip" })).toThrow();
    expect(() => healthGrantSchema.parse({ v: 2, kind: "patron" })).toThrow();
  });
});

describe("grant status persistence", () => {
  it("starts empty", () => {
    expect(grantStatus()).toEqual(NO_GRANT);
  });

  it("maps patron → supporter and partner → pro, additively", () => {
    expect(applyGrant({ v: 1, kind: "patron" })).toEqual({ supporter: true, pro: false });
    expect(grantStatus()).toEqual({ supporter: true, pro: false });
    // A second, professional grant adds pro without dropping supporter.
    expect(applyGrant({ v: 1, kind: "partner" })).toEqual({ supporter: true, pro: true });
    expect(grantStatus()).toEqual({ supporter: true, pro: true });
  });

  it("clearGrant forgets the imported status", () => {
    applyGrant({ v: 1, kind: "partner" });
    clearGrant();
    expect(grantStatus()).toEqual(NO_GRANT);
  });
});

describe("import gating (double-gated)", () => {
  it("is not configured without signing keys, and import is a no-op", async () => {
    // VITE_GRANT_* are unset in tests → grant import disabled.
    expect(grantConfigured()).toBe(false);
    expect(await importGrantFromFile()).toBeNull();
    expect(grantStatus()).toEqual(NO_GRANT);
  });
});
