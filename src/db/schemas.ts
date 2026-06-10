import type { SchemaDescriptor } from "sharedcorelib/schema";
import { ICE_CARD_SCHEMA } from "sharedcorelib/ice";
import { ENTITY_SCHEMAS } from "sharedcorelib/entities";
import { HEALTH_FACET_SCHEMA } from "./healthFacet";

/**
 * myHealth's contribution to the SHARED suite database (sharedcorelib/db). These are
 * SEMANTIC descriptors registered into the shared schema registry on launch (idempotent,
 * append-only) — they describe tables myHealth participates in within the suite DB,
 * SEPARATE from and additive to the app's own `myhealth.db` (see db/client.ts).
 *
 * Three groups, none duplicated across apps (the schema register blocks dup table
 * registration):
 *  - the common `common#IceCard` emergency card (sharedcorelib/ice) — keyed per person,
 *    read+written by every suite app; whichever launches first creates it.
 *  - the common shared-entity spine (sharedcorelib/entities): `common_person` /
 *    `common_event` / `common_document` / `common_asset` / `common_person_relationship`.
 *    Modeled ONCE in core; registering the identical descriptors is conflict-free.
 *  - myHealth's OWN per-app `myhealth#HealthFacet` (medical fields keyed by person_key) —
 *    the only table myHealth owns/writes-exclusively here.
 */
export const MYHEALTH_SCHEMAS: SchemaDescriptor[] = [
  ICE_CARD_SCHEMA,
  ...ENTITY_SCHEMAS,
  HEALTH_FACET_SCHEMA,
];
