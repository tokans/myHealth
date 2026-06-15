import { describe, it, expect } from "vitest";
import { GATES, gateVisibility, type GatingFlags, type GateKey } from "./featureGate";

const LOCKED: GatingFlags = {
  hasProfile: false,
  hasMetric: false,
  hasGoal: false,
  isTracker: false,
  isCaretaker: false,
  isChampion: false,
};
const flags = (over: Partial<GatingFlags> = {}): GatingFlags => ({ ...LOCKED, ...over });

describe("GATES config invariants", () => {
  it("every gate's key matches its record key, carries valid tier/lock metadata + CTA copy", () => {
    for (const [key, gate] of Object.entries(GATES)) {
      expect(gate.key).toBe(key);
      // A gate is either tier-gated OR a prerequisite gate with a static lockBehavior.
      if (gate.tier) {
        expect(["tracker", "caretaker", "champion"]).toContain(gate.tier);
        expect(gate.lockBehavior).toBeUndefined();
      } else {
        expect(["nudge", "hide"]).toContain(gate.lockBehavior);
      }
      expect(gate.lockedTitle).toBeTruthy();
      expect(gate.unlockHint).toBeTruthy();
      expect(gate.ctaLabel).toBeTruthy();
      expect(gate.ctaTo).toMatch(/^\//);
      expect(typeof gate.isUnlocked).toBe("function");
    }
  });
});

describe("gate unlock predicates", () => {
  it("Tracker-tier features open at Tracker", () => {
    const trackerGates: GateKey[] = ["goals", "schedule", "trends", "yoga"];
    for (const k of trackerGates) {
      expect(GATES[k].isUnlocked(LOCKED)).toBe(false);
      expect(GATES[k].isUnlocked(flags({ isTracker: true }))).toBe(true);
    }
  });

  it("Caretaker-tier features open at Caretaker", () => {
    for (const k of ["medications", "documents", "ice"] as GateKey[]) {
      expect(GATES[k].isUnlocked(flags({ isTracker: true }))).toBe(false);
      expect(GATES[k].isUnlocked(flags({ isCaretaker: true }))).toBe(true);
    }
  });

  it("Champion-tier features open at Champion", () => {
    for (const k of ["directory", "sync", "items"] as GateKey[]) {
      expect(GATES[k].isUnlocked(flags({ isCaretaker: true }))).toBe(false);
      expect(GATES[k].isUnlocked(flags({ isChampion: true }))).toBe(true);
    }
  });

  it("the family gate opens once a profile exists (a nudge, not a hide)", () => {
    expect(GATES.family.isUnlocked(LOCKED)).toBe(false);
    expect(GATES.family.isUnlocked(flags({ hasProfile: true }))).toBe(true);
    expect(GATES.family.lockBehavior).toBe("nudge");
  });
});

describe("gateVisibility — reveal exactly one tier ahead", () => {
  const TRACKER: GateKey[] = ["goals", "schedule", "trends", "yoga"];
  const CARETAKER: GateKey[] = ["medications", "documents", "ice"];
  const CHAMPION: GateKey[] = ["directory", "sync", "items"];

  it("a Starter sees Tracker features locked (nudge) but NOTHING of Caretaker/Champion", () => {
    const f = LOCKED; // Starter
    for (const k of TRACKER) expect(gateVisibility(k, f)).toBe("nudge");
    for (const k of CARETAKER) expect(gateVisibility(k, f)).toBe("hidden");
    for (const k of CHAMPION) expect(gateVisibility(k, f)).toBe("hidden");
  });

  it("a Tracker sees Tracker open, Caretaker locked (nudge), Champion hidden", () => {
    const f = flags({ isTracker: true });
    for (const k of TRACKER) expect(gateVisibility(k, f)).toBe("open");
    for (const k of CARETAKER) expect(gateVisibility(k, f)).toBe("nudge");
    for (const k of CHAMPION) expect(gateVisibility(k, f)).toBe("hidden");
  });

  it("a Caretaker sees Caretaker open and Champion locked (nudge)", () => {
    const f = flags({ isTracker: true, isCaretaker: true });
    for (const k of CARETAKER) expect(gateVisibility(k, f)).toBe("open");
    for (const k of CHAMPION) expect(gateVisibility(k, f)).toBe("nudge");
  });

  it("a Champion sees the top-tier features open", () => {
    const f = flags({ isTracker: true, isCaretaker: true, isChampion: true });
    for (const k of CHAMPION) expect(gateVisibility(k, f)).toBe("open");
  });

  it("prerequisite gates (family) follow their static lockBehavior", () => {
    expect(gateVisibility("family", LOCKED)).toBe("nudge");
    expect(gateVisibility("family", flags({ hasProfile: true }))).toBe("open");
  });
});
