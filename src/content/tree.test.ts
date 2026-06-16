import { describe, it, expect } from "vitest";
import {
  buildContentTreeFromGlob,
  nodeAt,
  nodeLabel,
  nodeEntries,
  propData,
  leaves,
} from "@/content/model";

/**
 * myHealth binding of the shared content TREE. In the app the file map comes from
 * `import.meta.glob('/content/**\/*', { query: '?raw', import: 'default', eager: true })`;
 * here we pass an equivalent inline map to prove the re-exported API works and that
 * a 2-level myHealth tree (type → leaf) folds correctly.
 */
const FILES: Record<string, string> = {
  "/content/yoga/label.txt": "Yoga",
  "/content/yoga/meta.yaml": "tier: tracker\norder: 10\nentryNoun: sequence",
  "/content/yoga/morning/title.txt": "Morning Flows",
  "/content/yoga/morning/entries.json": JSON.stringify([
    { id: "yoga-morning", name: "Morning Wake-Up", summary: "Loosen up.", steps: [{ title: "Mountain", instruction: "Stand tall." }] },
  ]),
  "/content/yoga/evening/title.txt": "Evening Wind-down",
  "/content/yoga/evening/entries.json": JSON.stringify([
    { id: "yoga-evening", name: "Evening Unwind", summary: "Wind down.", steps: [{ title: "Fold", instruction: "Reach down." }] },
  ]),
};

describe("myHealth content tree binding", () => {
  const root = buildContentTreeFromGlob(FILES);

  it("folds a 2-level tree: interim type with props, leaf subcategories with content", () => {
    const yoga = nodeAt(root, ["yoga"])!;
    expect(yoga.isLeaf).toBe(false);
    expect(nodeLabel(yoga)).toBe("Yoga");
    expect(propData(yoga, "meta")).toEqual({ tier: "tracker", order: 10, entryNoun: "sequence" });

    const morning = nodeAt(root, ["yoga", "morning"])!;
    expect(morning.isLeaf).toBe(true);
    expect(nodeLabel(morning)).toBe("Morning Flows");
    expect(nodeEntries(morning).map((e) => e.id)).toEqual(["yoga-morning"]);
  });

  it("lists every leaf", () => {
    expect(leaves(root).map((l) => l.key).sort()).toEqual(["evening", "morning"]);
  });
});
