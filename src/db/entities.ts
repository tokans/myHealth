/**
 * myHealth's bridge onto the shared-entity spine (sharedcorelib/entities) — Stage C
 * prompt 04 Phase 1 / Phase 3.
 *
 * The shared `person` / `event` / `document` tables are modeled ONCE in core and live in
 * the shared suite DB (`suite.db`). myHealth reads/writes them through the co-owned
 * `createEntitiesStore` (identity is explicit-reference — pick-or-create, NEVER auto-merge),
 * and attaches its medical data through the per-app `HealthFacet` table (see healthFacet.ts).
 *
 * This module is pure DI over an injected SqlDb so it is unit-testable with an in-memory
 * fake; the live wiring (open suite.db, adapter) is in db/sharedDb.ts. Standalone-safe:
 * callers that can't open the shared DB just skip it.
 *
 * INVARIANT: no health data egresses. Everything here is local SQLite; document blobs stay
 * AES-GCM under the per-device key (only opaque `blob_ref` metadata lands in `document`).
 */
import {
  createEntitiesStore,
  personKeyFor,
  type EntitiesStore,
  type Person,
} from "sharedcorelib/entities";
import type { SqlDb } from "sharedcorelib/db";
import { createHealthFacetStore, type HealthFacet, type HealthFacetStore } from "./healthFacet";
import { APP_ID } from "./healthFacet";

/** A profile as myHealth historically modeled it (the legacy `profiles` table shape). */
export interface LegacyProfile {
  name: string;
  relationship: string | null;
  is_self: number;
  dob: string | null;
  sex: string | null;
  blood_group: string | null;
  height_cm: number | null;
  notes: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  emergency_email: string | null;
  organ_donor: number;
  advance_directive: string | null;
}

/** A person + their myHealth medical facet, the unit pages now consume. */
export interface PersonWithFacet {
  person: Person;
  facet: HealthFacet | null;
}

export interface HealthPeople {
  entities: EntitiesStore;
  facets: HealthFacetStore;
  /** Create the spine + facet tables (idempotent). */
  ensure(): Promise<void>;
  /** Every person + their facet (pets included; they are managed-dependent persons). */
  list(): Promise<PersonWithFacet[]>;
  /** One person + facet by key. */
  get(personKey: string): Promise<PersonWithFacet | null>;
  /**
   * Add (or update the identity of) a managed person and their facet. Pets are persons too:
   * pass `isPet: true` and they get `relationship_to_self = 'pet'` + `facet.is_pet = 1`.
   * EXPLICIT-REFERENCE: returns/creates by key; never merges two identities.
   */
  upsertPerson(input: {
    name: string;
    isSelf?: boolean;
    isPet?: boolean;
    species?: string | null;
    relationship?: string | null;
    dob?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
    facet?: Partial<HealthFacet>;
  }): Promise<PersonWithFacet>;
  /** Remove a person and their facet. */
  remove(personKey: string): Promise<void>;
  /**
   * One-time migration: lift a legacy `profiles` row onto the shared person + facet.
   * Health OWNS the medical fields (sex/blood_group/height/conditions/meds/allergies/
   * advance_directive/organ_donor). Contact fields stay on `person` (finance/ICE precedent).
   */
  migrateLegacyProfile(p: LegacyProfile): Promise<PersonWithFacet>;
}

/** A bound handle on myHealth's people (shared person spine + the medical facet). */
export function createHealthPeople(db: SqlDb): HealthPeople {
  const entities = createEntitiesStore(db, { appId: APP_ID });
  const facets = createHealthFacetStore(db);

  async function get(personKey: string): Promise<PersonWithFacet | null> {
    const person = await entities.getPerson(personKey);
    if (!person) return null;
    return { person, facet: await facets.get(personKey) };
  }

  return {
    entities,
    facets,
    async ensure() {
      await entities.ensure();
      await facets.ensure();
    },
    async list() {
      const people = await entities.listPeople();
      const out: PersonWithFacet[] = [];
      for (const person of people) out.push({ person, facet: await facets.get(person.person_key) });
      return out;
    },
    get,
    async upsertPerson(input) {
      const isPet = !!input.isPet;
      const personKey = personKeyFor({ isSelf: !!input.isSelf, name: input.name });
      const relationship = isPet ? "pet" : input.relationship ?? (input.isSelf ? "self" : null);
      const person = await entities.pickOrCreatePerson(personKey, {
        display_name: input.name,
        relationship_to_self: relationship,
        dob: input.dob ?? null,
        contact_phone: input.contact_phone ?? null,
        contact_email: input.contact_email ?? null,
      });
      // pickOrCreatePerson returns existing unchanged; ensure identity edits land.
      await entities.upsertPerson({
        ...person,
        display_name: input.name,
        relationship_to_self: relationship,
        dob: input.dob ?? person.dob ?? null,
        contact_phone: input.contact_phone ?? person.contact_phone ?? null,
        contact_email: input.contact_email ?? person.contact_email ?? null,
      });
      if (input.facet || isPet) {
        const existing = await facets.get(personKey);
        await facets.upsert({
          ...(existing ?? {}),
          ...input.facet,
          person_key: personKey,
          is_pet: isPet ? 1 : input.facet?.is_pet ?? existing?.is_pet ?? 0,
          species: isPet ? input.species ?? input.facet?.species ?? existing?.species ?? null : input.facet?.species ?? existing?.species ?? null,
        });
      }
      return (await get(personKey))!;
    },
    async remove(personKey) {
      await facets.remove(personKey);
      await entities.removePerson(personKey);
    },
    async migrateLegacyProfile(p) {
      const isPet = (p.relationship ?? "").toLowerCase() === "pet";
      const isSelf = p.is_self === 1;
      const personKey = personKeyFor({ isSelf, name: p.name });
      await entities.upsertPerson({
        person_key: personKey,
        display_name: p.name,
        relationship_to_self: isPet ? "pet" : isSelf ? "self" : p.relationship,
        // contact lives on person (ICE/finance precedent) — emergency_* are the ICE contact.
        contact_phone: p.emergency_phone,
        contact_email: p.emergency_email,
        dob: p.dob,
      });
      await facets.upsert({
        person_key: personKey,
        sex: p.sex,
        blood_group: p.blood_group,
        height_cm: p.height_cm,
        advance_directive: p.advance_directive,
        organ_donor: p.organ_donor ? 1 : 0,
        is_pet: isPet ? 1 : 0,
        notes: p.notes,
      });
      return (await get(personKey))!;
    },
  };
}
