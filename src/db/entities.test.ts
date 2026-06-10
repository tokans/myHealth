import { describe, it, expect } from "vitest";
import { memDb } from "./memDb";
import { createHealthPeople, type LegacyProfile } from "./entities";

function legacy(p: Partial<LegacyProfile> & { name: string }): LegacyProfile {
  return {
    relationship: null,
    is_self: 0,
    dob: null,
    sex: null,
    blood_group: null,
    height_cm: null,
    notes: null,
    emergency_contact: null,
    emergency_phone: null,
    emergency_email: null,
    organ_donor: 0,
    advance_directive: null,
    ...p,
  };
}

describe("createHealthPeople — person spine + medical facet", () => {
  it("adds a self person on key 'self' with a facet", async () => {
    const people = createHealthPeople(memDb());
    await people.ensure();
    const pw = await people.upsertPerson({
      name: "Me",
      isSelf: true,
      facet: { conditions: "none", blood_group: "O+" },
    });
    expect(pw.person.person_key).toBe("self");
    expect(pw.person.relationship_to_self).toBe("self");
    expect(pw.facet?.blood_group).toBe("O+");
  });

  it("models a PET as a managed-dependent person with a health facet", async () => {
    const people = createHealthPeople(memDb());
    await people.ensure();
    const pw = await people.upsertPerson({
      name: "Rex",
      isPet: true,
      species: "Dog",
      facet: { conditions: "arthritis" },
    });
    expect(pw.person.relationship_to_self).toBe("pet");
    expect(pw.facet?.is_pet).toBe(1);
    expect(pw.facet?.species).toBe("Dog");
    expect(pw.facet?.conditions).toBe("arthritis");
    // appears in the unified people list alongside humans (reuses profile machinery)
    const all = await people.list();
    expect(all.map((p) => p.person.display_name)).toContain("Rex");
  });

  it("explicit-reference: re-upsert same key updates, never duplicates", async () => {
    const people = createHealthPeople(memDb());
    await people.ensure();
    await people.upsertPerson({ name: "Sam", relationship: "child" });
    await people.upsertPerson({ name: "Sam", relationship: "child", facet: { conditions: "x" } });
    const all = await people.list();
    expect(all.filter((p) => p.person.display_name === "Sam")).toHaveLength(1);
  });

  it("migrates a legacy profile: health owns medical, contact stays on person", async () => {
    const people = createHealthPeople(memDb());
    await people.ensure();
    const pw = await people.migrateLegacyProfile(
      legacy({
        name: "Me",
        is_self: 1,
        sex: "male",
        blood_group: "A+",
        height_cm: 178,
        advance_directive: "DNR",
        organ_donor: 1,
        emergency_phone: "+15551234567",
        emergency_email: "ice@example.com",
        dob: "1990-01-01",
      }),
    );
    // medical fields on the facet (health owns these)
    expect(pw.facet?.sex).toBe("male");
    expect(pw.facet?.blood_group).toBe("A+");
    expect(pw.facet?.advance_directive).toBe("DNR");
    expect(pw.facet?.organ_donor).toBe(1);
    // contact on the shared person identity (finance/ICE precedent), NOT the facet
    expect(pw.person.contact_phone).toBe("+15551234567");
    expect(pw.person.contact_email).toBe("ice@example.com");
    expect(pw.person.dob).toBe("1990-01-01");
  });

  it("migrates a legacy 'pet' profile onto a pet person with is_pet facet", async () => {
    const people = createHealthPeople(memDb());
    await people.ensure();
    const pw = await people.migrateLegacyProfile(legacy({ name: "Whiskers", relationship: "pet" }));
    expect(pw.person.relationship_to_self).toBe("pet");
    expect(pw.facet?.is_pet).toBe(1);
  });

  it("removes person and facet together", async () => {
    const people = createHealthPeople(memDb());
    await people.ensure();
    const pw = await people.upsertPerson({ name: "Temp", facet: { conditions: "y" } });
    await people.remove(pw.person.person_key);
    expect(await people.get(pw.person.person_key)).toBeNull();
    expect(await people.facets.get(pw.person.person_key)).toBeNull();
  });
});
