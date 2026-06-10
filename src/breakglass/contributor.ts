/**
 * myHealth break-glass contributor — Stage C prompt 04 Phase 2.
 *
 * myHealth is the **SECOND consumer** of the core break-glass mechanism
 * (sharedcorelib/breakglass) after myFinance — this is what makes the CONTRACT's
 * "two real consumers" rule real. Core ships only the mechanism (assemble + tier-filter +
 * seal); each app implements `BreakGlassContributor` in its OWN repo and does its OWN
 * redaction. No module-specific strings live in core.
 *
 * myHealth discloses the medical fields it owns — the ICE card (blood group, allergies,
 * conditions, current meds, organ-donor status, emergency contact) and the
 * **advance_directive** — split across recipient tiers so the most sensitive end-of-life
 * material only appears for the higher-trust tiers.
 *
 * Tier order (low → high), suite-standard:
 *   - "nominee"  — a trusted next-of-kin: gets life-saving emergency medical facts only.
 *   - "executor" — handling affairs: also gets the advance_directive (end-of-life wishes).
 *   - "full"     — full medical disclosure (notes / full history).
 *
 * INVARIANT: every section's `data` is recipient-safe and already redacted by THIS module;
 * nothing above a section's `minTier` is placed in it. This is assembled locally and
 * sealed by core under a system passphrase handed over out-of-band — the vendor only ever
 * holds ciphertext, and NO health data egresses on this (or any) path.
 */
import type { BreakGlassContributor, ContributorSection } from "sharedcorelib/breakglass";
import type { IceCard } from "sharedcorelib/ice";
import type { HealthFacet } from "@/db/healthFacet";

export const MODULE_ID = "myhealth";

/** myHealth's recipient tiers, ordered low → high. Pass to `buildSnapshot` as `tierOrder`. */
export const HEALTH_TIER_ORDER = ["nominee", "executor", "full"] as const;
export type HealthBreakGlassTier = (typeof HEALTH_TIER_ORDER)[number];

/** What a person contributes to the break-glass slice: their ICE card + medical facet. */
export interface PersonBreakGlassInput {
  /** Person display name for the section title (recipient-friendly). */
  displayName: string;
  ice: IceCard | null;
  facet: HealthFacet | null;
}

/** Drop null/empty entries so a section never leaks empty/placeholder fields. */
function compact(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

/**
 * Build the contributor sections for one person. Tiering:
 *   - nominee: life-saving emergency medical facts (blood group, allergies, conditions,
 *     current meds, organ-donor flag, emergency contact).
 *   - executor: the advance_directive (end-of-life wishes).
 *   - full: full medical notes.
 * Empty sections are omitted entirely.
 */
export function sectionsForPerson(input: PersonBreakGlassInput): ContributorSection[] {
  const { ice, facet, displayName } = input;
  const sections: ContributorSection[] = [];

  // nominee — emergency medical facts. Merge ICE card + facet (facet wins for medical it owns).
  const emergency = compact({
    blood_group: facet?.blood_group ?? ice?.blood_group ?? null,
    allergies: facet?.allergies ?? ice?.allergies ?? null,
    conditions: facet?.conditions ?? ice?.conditions ?? null,
    medications: facet?.medications ?? ice?.medications ?? null,
    organ_donor: (facet?.organ_donor ?? ice?.organ_donor) ? "yes" : null,
    emergency_contact_name: ice?.contact_name ?? null,
    emergency_contact_phone: ice?.contact_phone ?? null,
    emergency_contact_email: ice?.contact_email ?? null,
  });
  if (Object.keys(emergency).length > 0) {
    sections.push({
      module: MODULE_ID,
      minTier: "nominee",
      title: `Emergency medical — ${displayName}`,
      data: emergency,
    });
  }

  // executor — advance directive (end-of-life wishes); higher trust than raw emergency facts.
  const directive = compact({
    advance_directive: facet?.advance_directive ?? ice?.advance_directive ?? null,
  });
  if (Object.keys(directive).length > 0) {
    sections.push({
      module: MODULE_ID,
      minTier: "executor",
      title: `Advance directive — ${displayName}`,
      data: directive,
    });
  }

  // full — complete medical notes / detail.
  const full = compact({ notes: facet?.notes ?? null });
  if (Object.keys(full).length > 0) {
    sections.push({
      module: MODULE_ID,
      minTier: "full",
      title: `Medical notes — ${displayName}`,
      data: full,
    });
  }

  return sections;
}

/**
 * Create myHealth's break-glass contributor over a set of people (self + family + pets).
 * `load()` returns the current ICE cards + facets — injected so the contributor stays pure
 * and unit-testable; the live wiring reads them from the shared suite DB.
 */
export function createHealthBreakGlassContributor(
  load: () => Promise<PersonBreakGlassInput[]> | PersonBreakGlassInput[],
): BreakGlassContributor {
  return {
    module: MODULE_ID,
    async sections() {
      const people = await load();
      return people.flatMap(sectionsForPerson);
    },
  };
}
