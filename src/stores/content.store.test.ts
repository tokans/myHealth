import { describe, it, expect, beforeEach } from "vitest";
import { useContentStore } from "./content.store";
import type { ContentBundle } from "@/content/model";

const bundle = (id: string, version = 1): ContentBundle => ({
  bundleId: id,
  name: id.toUpperCase(),
  version,
  entries: [{ id: `${id}-1`, name: "E", summary: "s", source: "bundle", bundleId: id, steps: [{ title: "a", instruction: "b" }] }],
});

describe("useContentStore", () => {
  beforeEach(() => {
    useContentStore.setState({ bundlesByType: {}, revisionByType: {}, remoteTypes: [], catalogRevision: 0, lastCheckedAt: 0 });
  });

  it("upserts bundles per type and replaces same-id rather than duplicating", () => {
    useContentStore.getState().upsertBundle("yoga", bundle("a", 1));
    useContentStore.getState().upsertBundle("yoga", bundle("a", 2));
    useContentStore.getState().upsertBundle("yoga", bundle("b"));
    const yoga = useContentStore.getState().bundlesByType.yoga!;
    expect(yoga.map((b) => b.bundleId)).toEqual(["a", "b"]);
    expect(yoga.find((b) => b.bundleId === "a")!.version).toBe(2);
  });

  it("keeps bundles isolated per type", () => {
    useContentStore.getState().upsertBundle("yoga", bundle("a"));
    useContentStore.getState().upsertBundle("exercises", bundle("c"));
    expect(useContentStore.getState().bundlesByType.yoga).toHaveLength(1);
    expect(useContentStore.getState().bundlesByType.exercises).toHaveLength(1);
  });

  it("removes a bundle by id", () => {
    useContentStore.getState().upsertBundle("yoga", bundle("a"));
    useContentStore.getState().removeBundle("yoga", "a");
    expect(useContentStore.getState().bundlesByType.yoga).toEqual([]);
  });

  it("tracks per-type and catalog revisions", () => {
    useContentStore.getState().setRevision("yoga", 5);
    useContentStore.getState().setCatalogRevision(3);
    expect(useContentStore.getState().revisionByType.yoga).toBe(5);
    expect(useContentStore.getState().catalogRevision).toBe(3);
  });

  it("registers/replaces a remote type by key", () => {
    const meta = { key: "meditation", label: "Meditation", iconName: "Brain", tier: "tracker" as const, releaseTag: "content-meditation-latest" };
    useContentStore.getState().registerRemoteType(meta);
    useContentStore.getState().registerRemoteType({ ...meta, label: "Meditation 2" });
    expect(useContentStore.getState().remoteTypes).toHaveLength(1);
    expect(useContentStore.getState().remoteTypes[0]!.label).toBe("Meditation 2");
  });
});
