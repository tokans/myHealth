import { describe, it, expect } from "vitest";
import {
  buildSnapshot,
  generateRecipientPassphrase,
  wrapSlice,
  openSlice,
} from "sharedcorelib/breakglass";
import type { IceCard } from "sharedcorelib/ice";
import type { HealthFacet } from "@/db/healthFacet";
import {
  createHealthBreakGlassContributor,
  sectionsForPerson,
  HEALTH_TIER_ORDER,
  MODULE_ID,
  type PersonBreakGlassInput,
} from "./contributor";

const ice: IceCard = {
  person_key: "self",
  display_name: "Me",
  blood_group: "O+",
  contact_name: "Jane",
  contact_phone: "+15551234567",
  allergies: "penicillin",
  conditions: "asthma",
  organ_donor: 1,
};

const facet: HealthFacet = {
  person_key: "self",
  advance_directive: "DNR — no resuscitation",
  medications: "salbutamol",
  notes: "full clinical history here",
  organ_donor: 1,
};

const input: PersonBreakGlassInput = { displayName: "Me", ice, facet };

describe("sectionsForPerson — tiering", () => {
  it("puts emergency medical at nominee, directive at executor, notes at full", () => {
    const secs = sectionsForPerson(input);
    const byTier = Object.fromEntries(secs.map((s) => [s.minTier, s]));
    expect(byTier.nominee.data.blood_group).toBe("O+");
    expect(byTier.nominee.data.allergies).toBe("penicillin");
    expect(byTier.nominee.data.medications).toBe("salbutamol");
    expect(byTier.nominee.data.organ_donor).toBe("yes");
    expect(byTier.executor.data.advance_directive).toBe("DNR — no resuscitation");
    expect(byTier.full.data.notes).toBe("full clinical history here");
    // every section is provenance-tagged to myHealth
    expect(secs.every((s) => s.module === MODULE_ID)).toBe(true);
  });

  it("does NOT leak the advance_directive into the nominee section", () => {
    const secs = sectionsForPerson(input);
    const nominee = secs.find((s) => s.minTier === "nominee")!;
    expect(JSON.stringify(nominee.data)).not.toContain("DNR");
    expect("advance_directive" in nominee.data).toBe(false);
  });

  it("omits empty sections", () => {
    const secs = sectionsForPerson({ displayName: "Bare", ice: null, facet: null });
    expect(secs).toHaveLength(0);
  });
});

describe("createHealthBreakGlassContributor — second consumer of core break-glass", () => {
  it("a nominee recipient sees ONLY emergency facts (not directive/notes)", async () => {
    const contributor = createHealthBreakGlassContributor(() => [input]);
    const snap = await buildSnapshot([contributor], "nominee", [...HEALTH_TIER_ORDER]);
    const titles = snap.sections.map((s) => s.title);
    expect(titles.some((t) => t.startsWith("Emergency medical"))).toBe(true);
    expect(titles.some((t) => t.startsWith("Advance directive"))).toBe(false);
    expect(titles.some((t) => t.startsWith("Medical notes"))).toBe(false);
  });

  it("an executor recipient ALSO sees the advance directive", async () => {
    const contributor = createHealthBreakGlassContributor(() => [input]);
    const snap = await buildSnapshot([contributor], "executor", [...HEALTH_TIER_ORDER]);
    const titles = snap.sections.map((s) => s.title);
    expect(titles.some((t) => t.startsWith("Emergency medical"))).toBe(true);
    expect(titles.some((t) => t.startsWith("Advance directive"))).toBe(true);
    expect(titles.some((t) => t.startsWith("Medical notes"))).toBe(false);
  });

  it("a full recipient sees everything", async () => {
    const contributor = createHealthBreakGlassContributor(() => [input]);
    const snap = await buildSnapshot([contributor], "full", [...HEALTH_TIER_ORDER]);
    expect(snap.sections).toHaveLength(3);
  });

  it("interops with two contributors (proves the contract holds with a second consumer)", async () => {
    const health = createHealthBreakGlassContributor(() => [input]);
    const fakeFinance = {
      module: "myfinance",
      sections: () => [
        { module: "myfinance", minTier: "nominee", title: "Accounts", data: { bank: "x" } },
      ],
    };
    const snap = await buildSnapshot([health, fakeFinance], "nominee", [...HEALTH_TIER_ORDER]);
    const modules = new Set(snap.sections.map((s) => s.module));
    expect(modules.has("myhealth")).toBe(true);
    expect(modules.has("myfinance")).toBe(true);
  });

  it("seals + opens through core: passphrase-only recipient reader recovers the medical fields", async () => {
    const contributor = createHealthBreakGlassContributor(() => [input]);
    const snap = await buildSnapshot([contributor], "executor", [...HEALTH_TIER_ORDER]);
    const pass = generateRecipientPassphrase();
    const blob = await wrapSlice(snap, pass);
    // free, login-less reader: passphrase ONLY
    const opened = await openSlice(blob, pass);
    const directive = opened.sections.find((s) => s.title.startsWith("Advance directive"));
    expect(directive?.data.advance_directive).toBe("DNR — no resuscitation");
    // wrong passphrase fails (ciphertext is opaque)
    await expect(openSlice(blob, "WRONG-PASSPHRASE")).rejects.toBeTruthy();
  });
});
