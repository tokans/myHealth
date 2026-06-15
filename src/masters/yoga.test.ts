import { describe, it, expect, beforeEach } from "vitest";
import { yogaBundleSchema, yogaUpdatesConfigured, checkYogaUpdates } from "./yoga";
import { useYogaStore } from "@/stores/yoga.store";

const validBundle = {
  bundleId: "restorative",
  name: "Restorative Pack",
  description: "Calming sequences",
  version: 2,
  sequences: [
    {
      id: "restorative-evening",
      name: "Evening Unwind",
      level: "beginner",
      focus: "Relaxation",
      summary: "Slow stretches before sleep.",
      steps: [{ title: "Child's Pose", instruction: "Fold forward and rest.", durationSec: 60 }],
    },
  ],
};

describe("yogaBundleSchema", () => {
  it("accepts a well-formed bundle", () => {
    expect(yogaBundleSchema.parse(validBundle).bundleId).toBe("restorative");
  });

  it("rejects an unsafe image url (only data:/https: allowed)", () => {
    const bad = {
      ...validBundle,
      sequences: [
        {
          ...validBundle.sequences[0],
          steps: [{ title: "x", instruction: "y", image: "javascript:alert(1)" }],
        },
      ],
    };
    expect(() => yogaBundleSchema.parse(bad)).toThrow();
  });

  it("rejects a bundle with no sequences", () => {
    expect(() => yogaBundleSchema.parse({ ...validBundle, sequences: [] })).toThrow();
  });
});

describe("yogaUpdatesConfigured", () => {
  it("is false without signing keys configured (default test env)", () => {
    expect(yogaUpdatesConfigured()).toBe(false);
  });
});

describe("checkYogaUpdates", () => {
  beforeEach(() => {
    useYogaStore.setState({ bundles: [], revision: 0 });
  });

  it("no-ops (returns false) when unconfigured / outside Tauri", async () => {
    const applied = await checkYogaUpdates({ force: true });
    expect(applied).toBe(false);
    expect(useYogaStore.getState().bundles).toEqual([]);
  });
});

describe("useYogaStore", () => {
  beforeEach(() => {
    useYogaStore.setState({ bundles: [], revision: 0 });
  });

  it("upserts a bundle and flattens its sequences with source tags", () => {
    useYogaStore.getState().upsertBundle({
      bundleId: "restorative",
      name: "Restorative Pack",
      version: 1,
      sequences: [
        {
          id: "restorative-evening",
          name: "Evening Unwind",
          level: "beginner",
          focus: "Relaxation",
          summary: "s",
          source: "bundle",
          bundleId: "restorative",
          steps: [{ title: "a", instruction: "b" }],
        },
      ],
    });
    const seqs = useYogaStore.getState().sequences();
    expect(seqs).toHaveLength(1);
    expect(seqs[0]!.source).toBe("bundle");
    expect(seqs[0]!.bundleId).toBe("restorative");
  });

  it("replaces a bundle of the same id rather than duplicating", () => {
    const base = { bundleId: "x", name: "X", version: 1, sequences: [] };
    useYogaStore.getState().upsertBundle(base);
    useYogaStore.getState().upsertBundle({ ...base, version: 2, name: "X2" });
    expect(useYogaStore.getState().bundles).toHaveLength(1);
    expect(useYogaStore.getState().bundles[0]!.name).toBe("X2");
  });

  it("removes a bundle by id", () => {
    useYogaStore.getState().upsertBundle({ bundleId: "x", name: "X", version: 1, sequences: [] });
    useYogaStore.getState().removeBundle("x");
    expect(useYogaStore.getState().bundles).toEqual([]);
  });
});
