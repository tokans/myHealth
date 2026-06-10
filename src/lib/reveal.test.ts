import { describe, it, expect } from "vitest";
import {
  healthRevealKey,
  createRevealStore,
  pickHealthNudge,
  MYLIFEASSISTANT_NUDGE,
} from "./reveal";

function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  } as Pick<Storage, "getItem" | "setItem">;
}

describe("person-linked reveal keys", () => {
  it("namespaces by (person, app, gate) so people/apps never collide", () => {
    const self = healthRevealKey("self", "import");
    const child = healthRevealKey("child-sam", "import");
    expect(self).not.toBe(child);
    expect(self).toContain("myhealth");
  });
});

describe("createRevealStore — per-person dismissal", () => {
  it("dismissal is scoped to the person", () => {
    const store = createRevealStore(memStorage());
    store.dismiss("self", "g");
    expect(store.isDismissed("self", "g")).toBe(true);
    expect(store.isDismissed("child-sam", "g")).toBe(false);
  });
});

describe("pickHealthNudge — myLifeAssistant nudge", () => {
  const base = {
    catalogHas: () => true,
    installed: () => false,
  };

  it("shows the nudge at the top of the free ladder for a non-paid, undismissed person", () => {
    const n = pickHealthNudge({
      ctx: { atTopOfFreeLadder: true, tier: "free" },
      reveal: createRevealStore(memStorage()),
      ...base,
    });
    expect(n?.target).toBe(MYLIFEASSISTANT_NUDGE.target);
  });

  it("does NOT show before the top of the ladder", () => {
    const n = pickHealthNudge({
      ctx: { atTopOfFreeLadder: false, tier: "free" },
      reveal: createRevealStore(memStorage()),
      ...base,
    });
    expect(n).toBeNull();
  });

  it("does NOT show once that person dismissed it (person-linked)", () => {
    const reveal = createRevealStore(memStorage());
    reveal.dismiss("self", "mylifeassistant-nudge");
    const n = pickHealthNudge({
      ctx: { atTopOfFreeLadder: true, tier: "free" },
      personKey: "self",
      reveal,
      ...base,
    });
    expect(n).toBeNull();
  });

  it("does NOT show when the target app is already installed", () => {
    const n = pickHealthNudge({
      ctx: { atTopOfFreeLadder: true, tier: "free" },
      reveal: createRevealStore(memStorage()),
      catalogHas: () => true,
      installed: () => true,
    });
    expect(n).toBeNull();
  });
});
