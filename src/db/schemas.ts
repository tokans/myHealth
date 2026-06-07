import type { SchemaDescriptor } from "sharedcorelib/schema";
import { ICE_CARD_SCHEMA } from "sharedcorelib/ice";

/**
 * myHealth's contribution to the SHARED suite database (sharedcorelib/db). These are
 * SEMANTIC descriptors registered into the shared schema registry on launch (idempotent,
 * append-only) — they describe tables myHealth participates in within the suite DB,
 * SEPARATE from and additive to the app's own `myhealth.db` (see db/client.ts).
 *
 * Today this is just the common `common#IceCard` emergency card: a single shared row-set
 * keyed per person that EITHER suite app (myHealth, myFinance) may read and edit. Because
 * both apps register this identical descriptor, whichever launches first creates the
 * table and the other reuses it — never a conflict, never a duplicate.
 */
export const MYHEALTH_SCHEMAS: SchemaDescriptor[] = [ICE_CARD_SCHEMA];
