import { describe, it, expect } from "vitest";
import { checkAgainstRegistry, validateDescriptor, qualifiedName } from "sharedcorelib/schema";
import { ICE_CARD_SCHEMA } from "sharedcorelib/ice";
import { ENTITY_SCHEMAS } from "sharedcorelib/entities";
import { MYHEALTH_SCHEMAS } from "./schemas";
import { HEALTH_FACET_SCHEMA } from "./healthFacet";

describe("MYHEALTH_SCHEMAS registration into the shared suite DB", () => {
  it("every descriptor validates", () => {
    for (const s of MYHEALTH_SCHEMAS) {
      const r = validateDescriptor(s);
      expect(r.ok, `${qualifiedName(s)}: ${JSON.stringify(r.issues)}`).toBe(true);
    }
  });

  it("registers cleanly into an empty registry with no conflicts (no dup tables)", () => {
    const res = checkAgainstRegistry(MYHEALTH_SCHEMAS, {});
    expect(res.hasConflicts).toBe(false);
  });

  it("re-registering the same set is idempotent (identical) — no dup registration", () => {
    const registry = Object.fromEntries(MYHEALTH_SCHEMAS.map((s) => [qualifiedName(s), s]));
    const res = checkAgainstRegistry(MYHEALTH_SCHEMAS, registry);
    expect(res.hasConflicts).toBe(false);
    expect(res.entries.every((e) => e.status === "identical")).toBe(true);
  });

  it("keeps the common ICE card (unchanged) and adds the entity spine + the health facet", () => {
    expect(MYHEALTH_SCHEMAS).toContain(ICE_CARD_SCHEMA);
    for (const s of ENTITY_SCHEMAS) expect(MYHEALTH_SCHEMAS).toContain(s);
    expect(MYHEALTH_SCHEMAS).toContain(HEALTH_FACET_SCHEMA);
  });

  it("the only myHealth-OWNED table is the health facet; the rest are common (shared, not duplicated)", () => {
    const owned = MYHEALTH_SCHEMAS.filter((s) => s.owner === "myhealth");
    expect(owned).toEqual([HEALTH_FACET_SCHEMA]);
    for (const s of MYHEALTH_SCHEMAS) {
      if (s !== HEALTH_FACET_SCHEMA) expect(s.owner).toBe("common");
    }
  });
});
