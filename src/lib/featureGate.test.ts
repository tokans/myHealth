import { describe, it, expect } from "vitest";
import { GATES, type GatingFlags, type GateKey } from "./featureGate";

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
  it("every gate's key matches its record key and has valid lockBehavior + CTA copy", () => {
    for (const [key, gate] of Object.entries(GATES)) {
      expect(gate.key).toBe(key);
      expect(["nudge", "hide"]).toContain(gate.lockBehavior);
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
    const trackerGates: GateKey[] = ["goals", "schedule", "trends", "medications", "documents"];
    for (const k of trackerGates) {
      expect(GATES[k].isUnlocked(LOCKED)).toBe(false);
      expect(GATES[k].isUnlocked(flags({ isTracker: true }))).toBe(true);
    }
  });

  it("Caretaker-tier features open at Caretaker", () => {
    for (const k of ["ice", "import", "directory"] as GateKey[]) {
      expect(GATES[k].isUnlocked(flags({ isTracker: true }))).toBe(false);
      expect(GATES[k].isUnlocked(flags({ isCaretaker: true }))).toBe(true);
    }
  });

  it("Champion-tier features open at Champion", () => {
    for (const k of ["sync", "items"] as GateKey[]) {
      expect(GATES[k].isUnlocked(flags({ isCaretaker: true }))).toBe(false);
      expect(GATES[k].isUnlocked(flags({ isChampion: true }))).toBe(true);
    }
  });

  it("the family gate opens once a profile exists (a nudge, not a hide)", () => {
    expect(GATES.family.isUnlocked(LOCKED)).toBe(false);
    expect(GATES.family.isUnlocked(flags({ hasProfile: true }))).toBe(true);
    expect(GATES.family.lockBehavior).toBe("nudge");
  });

  it("import is teased to newcomers (nudge), unlike the hidden Tracker features", () => {
    expect(GATES.import.lockBehavior).toBe("nudge");
    expect(GATES.goals.lockBehavior).toBe("hide");
  });
});
