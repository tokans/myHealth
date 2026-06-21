/**
 * Generate `schema.manifest.json` (the publisher-ci `schema-merge` input) from the SINGLE
 * source of truth — `src/db/schemas.ts` (`MYHEALTH_SCHEMAS` = the common entity spine +
 * the common ICE card + the app-owned `myhealth_*` tables). publisher-ci reads a flat JSON
 * ARRAY of semantic SchemaDescriptors and conflict-checks it against the shared registry on
 * publish, so the manifest must mirror exactly what `registerSchemas` registers at runtime —
 * no drift.
 *
 * Run: `npm run schema:manifest` (also invoked by `npm run verify` before the gate).
 *
 * Health data stays 100% local — this file is only data-shape metadata (no values), and
 * nothing here egresses.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// tsx is required to import the TS source directly. Invoked via the npm script.
const { MYHEALTH_SCHEMAS } = await import("../src/db/schemas.ts");

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "schema.manifest.json");
writeFileSync(out, JSON.stringify(MYHEALTH_SCHEMAS, null, 2) + "\n");
console.log(`wrote ${MYHEALTH_SCHEMAS.length} descriptors → schema.manifest.json`);
