import { describe, it, expect, beforeEach } from "vitest";
import { BAKED_CONTENT_TYPES, mergeTypes, findContentType, allContentTypes } from "./registry";
import { useContentStore } from "@/stores/content.store";
import type { ContentTypeMeta } from "./model";

describe("baked content registry (auto-discovered folders)", () => {
  it("discovers the yoga + exercises folders as tabs, ordered", () => {
    const keys = BAKED_CONTENT_TYPES.map((t) => t.key);
    expect(keys).toContain("yoga");
    expect(keys).toContain("exercises");
    // yoga.order=10 < exercises.order=20
    expect(keys.indexOf("yoga")).toBeLessThan(keys.indexOf("exercises"));
  });

  it("each baked type carries an icon, a tier, baked samples and a release tag", () => {
    for (const t of BAKED_CONTENT_TYPES) {
      expect(t.icon).toBeTruthy();
      expect(["tracker", "caretaker", "champion"]).toContain(t.tier);
      expect(t.releaseTag).toMatch(/^content-/);
      expect(t.samples.length).toBeGreaterThan(0);
      expect(t.source).toBe("baked");
    }
  });
});

describe("mergeTypes", () => {
  const remote: ContentTypeMeta = {
    key: "meditation",
    label: "Meditation",
    iconName: "Brain",
    tier: "tracker",
    releaseTag: "content-meditation-latest",
    order: 30,
  };

  it("adds a remote-only type and resolves its icon", () => {
    const merged = mergeTypes(BAKED_CONTENT_TYPES, [remote]);
    const med = findContentType(merged, "meditation");
    expect(med).toBeTruthy();
    expect(med!.source).toBe("remote");
    expect(med!.icon).toBeTruthy();
    expect(med!.samples).toEqual([]);
  });

  it("lets baked win a key collision (keeps baked samples)", () => {
    const collide: ContentTypeMeta = { ...remote, key: "yoga", label: "Remote Yoga" };
    const merged = mergeTypes(BAKED_CONTENT_TYPES, [collide]);
    expect(findContentType(merged, "yoga")!.label).toBe("Yoga");
    expect(findContentType(merged, "yoga")!.source).toBe("baked");
  });
});

describe("allContentTypes (baked ⊕ remotely-registered)", () => {
  beforeEach(() => {
    useContentStore.setState({ remoteTypes: [] });
  });

  it("includes types registered into the store", () => {
    useContentStore.getState().registerRemoteType({
      key: "meditation",
      label: "Meditation",
      iconName: "Brain",
      tier: "tracker",
      releaseTag: "content-meditation-latest",
    });
    expect(allContentTypes().map((t) => t.key)).toContain("meditation");
  });
});
