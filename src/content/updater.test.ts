import { describe, it, expect, beforeEach } from "vitest";
import { contentUpdatesConfigured, runContentSync, checkTypeNow } from "./updater";
import { contentBundleSchema, contentTypeMetaSchema } from "./schema";
import { useContentStore } from "@/stores/content.store";
import { BAKED_CONTENT_TYPES } from "./registry";

describe("contentUpdatesConfigured", () => {
  it("is false without signing keys (default test env)", () => {
    expect(contentUpdatesConfigured()).toBe(false);
  });
});

describe("sync is a no-op when unconfigured / outside Tauri", () => {
  beforeEach(() => {
    useContentStore.setState({ bundlesByType: {}, revisionByType: {}, remoteTypes: [], catalogRevision: 0, lastCheckedAt: 0 });
  });

  it("runContentSync returns false and applies nothing", async () => {
    expect(await runContentSync({ force: true })).toBe(false);
    expect(useContentStore.getState().bundlesByType).toEqual({});
    expect(useContentStore.getState().remoteTypes).toEqual([]);
  });

  it("checkTypeNow returns false", async () => {
    expect(await checkTypeNow(BAKED_CONTENT_TYPES[0]!)).toBe(false);
  });
});

describe("schema gates payloads after verify/decrypt", () => {
  const goodBundle = {
    bundleId: "p",
    name: "Pack",
    version: 1,
    entries: [{ id: "e1", name: "E", summary: "s", steps: [{ title: "a", instruction: "b", durationSec: 30 }] }],
  };

  it("accepts a well-formed bundle", () => {
    expect(contentBundleSchema.parse(goodBundle).bundleId).toBe("p");
  });

  it("rejects an unsafe image url (only data:/https:)", () => {
    const bad = { ...goodBundle, entries: [{ ...goodBundle.entries[0], steps: [{ title: "a", instruction: "b", image: "javascript:1" }] }] };
    expect(() => contentBundleSchema.parse(bad)).toThrow();
  });

  it("validates a remote type meta and rejects a bad key", () => {
    const meta = { key: "meditation", label: "Meditation", iconName: "Brain", tier: "tracker", releaseTag: "content-meditation-latest" };
    expect(contentTypeMetaSchema.parse(meta).key).toBe("meditation");
    expect(() => contentTypeMetaSchema.parse({ ...meta, key: "Bad Key!" })).toThrow();
  });
});
