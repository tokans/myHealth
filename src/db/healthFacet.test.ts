import { describe, it, expect } from "vitest";
import { validateDescriptor } from "sharedcorelib/schema";
import { memDb } from "./memDb";
import {
  HEALTH_FACET_SCHEMA,
  createHealthFacetStore,
  APP_ID,
} from "./healthFacet";

describe("HEALTH_FACET_SCHEMA", () => {
  it("is a valid, app-owned (not common) Restricted schema", () => {
    const r = validateDescriptor(HEALTH_FACET_SCHEMA);
    expect(r.ok, JSON.stringify(r.issues)).toBe(true);
    expect(HEALTH_FACET_SCHEMA.owner).toBe(APP_ID);
    expect(HEALTH_FACET_SCHEMA.shared).not.toBe(true); // per-app facet, NOT a common table
    expect(HEALTH_FACET_SCHEMA.confidentiality).toBe("Restricted");
  });

  it("owns the medical fields keyed by person_key", () => {
    const names = HEALTH_FACET_SCHEMA.fields.map((f) => f.name);
    for (const f of ["conditions", "medications", "advance_directive", "organ_donor", "allergies"]) {
      expect(names).toContain(f);
    }
    const key = HEALTH_FACET_SCHEMA.fields.find((f) => f.keyField);
    expect(key?.name).toBe("person_key");
  });

  it("does NOT own contact fields (finance/ICE precedent)", () => {
    const names = HEALTH_FACET_SCHEMA.fields.map((f) => f.name);
    expect(names).not.toContain("contact_phone");
    expect(names).not.toContain("contact_email");
    expect(names).not.toContain("emergency_phone");
  });
});

describe("createHealthFacetStore", () => {
  it("upserts and reads back a facet, stamping source_app", async () => {
    const store = createHealthFacetStore(memDb());
    await store.ensure();
    await store.upsert({ person_key: "self", conditions: "asthma", organ_donor: 1 });
    const got = await store.get("self");
    expect(got?.conditions).toBe("asthma");
    expect(got?.organ_donor).toBe(1);
    expect(got?.source_app).toBe(APP_ID);
    expect(got?.updated_at).toBeTruthy();
  });

  it("coerces organ_donor and is_pet to 0/1", async () => {
    const store = createHealthFacetStore(memDb());
    await store.ensure();
    await store.upsert({ person_key: "rex", organ_donor: 0, is_pet: 1 });
    const got = await store.get("rex");
    expect(got?.organ_donor).toBe(0);
    expect(got?.is_pet).toBe(1);
  });

  it("removes a facet", async () => {
    const store = createHealthFacetStore(memDb());
    await store.ensure();
    await store.upsert({ person_key: "self" });
    await store.remove("self");
    expect(await store.get("self")).toBeNull();
  });
});
