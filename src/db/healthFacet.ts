/**
 * myHealth's **health facet** on the shared-entity spine (Stage C, prompt 04 Phase 1).
 *
 * The shared `person` (sharedcorelib/entities) is identity ONLY. Domain data lives in
 * per-app facet tables keyed by `person_key` — field-level ownership. This is myHealth's
 * facet: the medical fields the app owns (vitals, meds, conditions, advance_directive,
 * organ_donor). Contact fields stay on `person` / the common ICE card (finance owns
 * contact — the ICE precedent); health owns the MEDICAL fields here.
 *
 * It is an app-owned table in the shared suite DB (`owner: "myhealth"`, namespaced
 * `myhealth#HealthFacet`), so only myHealth writes it; other apps may read it through the
 * confidentiality-governed handle. One row per person, `person_key` = the same key used by
 * the common `person` row and the common ICE card (so all three line up per person).
 *
 * Pets are modeled as **managed-dependent persons** (a `person` row with
 * `relationship_to_self = 'pet'`) carrying a health facet — no separate app, no separate
 * table; the same profile/vitals/meds machinery applies.
 *
 * DI/pure: everything runs against an injected SqlDb (the Tauri SQL plugin in the app, an
 * in-memory fake in tests). No health data leaves the device — this is all local SQLite.
 */
import { createTableSql, tableName, type SqlDb } from "sharedcorelib/db";
import type { SchemaDescriptor } from "sharedcorelib/schema";

export const APP_ID = "myhealth";

/**
 * `myhealth#HealthFacet` — the per-person medical facet myHealth owns. Restricted
 * confidentiality (medical data); every personal field carries a DPDP purpose. One row
 * per `person_key`.
 */
export const HEALTH_FACET_SCHEMA: SchemaDescriptor = {
  namespace: "myhealth",
  name: "HealthFacet",
  plural: "HealthFacets",
  dbAlias: "myhealth_health_facet",
  schemaType: "Table",
  confidentiality: "Restricted",
  owner: APP_ID,
  purpose: "Per-person medical facet on the shared person spine; the medical fields myHealth owns.",
  fields: [
    {
      name: "person_key",
      dataType: "id",
      keyField: true,
      editability: "Immutable",
      description: "shared person key (matches the common person row + ICE card)",
    },
    {
      name: "sex",
      dataType: "string",
      personalData: true,
      purpose: "Sex-aware vitals ranges and screening schedules.",
      description: "female|male|other|unspecified",
    },
    {
      name: "blood_group",
      dataType: "string",
      personalData: true,
      purpose: "Emergency medical info.",
      description: "blood group (e.g. O+)",
    },
    {
      name: "height_cm",
      dataType: "number",
      personalData: true,
      purpose: "BMI / vitals derivation.",
      description: "height in centimetres",
      constraints: { unit: "cm" },
    },
    {
      name: "conditions",
      dataType: "string",
      personalData: true,
      purpose: "Record chronic conditions for care + emergency disclosure.",
      description: "free-text / list of medical conditions",
    },
    {
      name: "medications",
      dataType: "string",
      personalData: true,
      purpose: "Record current medications for care + emergency disclosure.",
      description: "free-text / list of current medications",
    },
    {
      name: "allergies",
      dataType: "string",
      personalData: true,
      purpose: "Critical emergency medical info.",
      description: "free-text / list of allergies",
    },
    {
      name: "advance_directive",
      dataType: "string",
      personalData: true,
      purpose: "Honour end-of-life wishes in an emergency / break-glass.",
      description: "advance directive (e.g. DNR / living will summary)",
    },
    {
      name: "organ_donor",
      dataType: "boolean",
      personalData: true,
      purpose: "Surface organ-donor status in an emergency.",
      description: "1 = registered organ donor",
    },
    {
      name: "is_pet",
      dataType: "boolean",
      description: "1 when this person is a managed-dependent pet",
    },
    {
      name: "species",
      dataType: "string",
      description: "pet species/breed (only meaningful when is_pet = 1)",
    },
    { name: "notes", dataType: "string", personalData: true, purpose: "Free-text medical notes.", description: "notes" },
    { name: "updated_at", dataType: "date", description: "ISO timestamp of the last edit" },
    { name: "source_app", dataType: "string", description: "app id that last wrote this row" },
  ],
};

/** One row of myHealth's per-person medical facet. */
export interface HealthFacet {
  person_key: string;
  sex?: string | null;
  blood_group?: string | null;
  height_cm?: number | null;
  conditions?: string | null;
  medications?: string | null;
  allergies?: string | null;
  advance_directive?: string | null;
  organ_donor?: number | null;
  is_pet?: number | null;
  species?: string | null;
  notes?: string | null;
  updated_at?: string | null;
  source_app?: string | null;
}

const COLS: (keyof HealthFacet)[] = [
  "person_key",
  "sex",
  "blood_group",
  "height_cm",
  "conditions",
  "medications",
  "allergies",
  "advance_directive",
  "organ_donor",
  "is_pet",
  "species",
  "notes",
  "updated_at",
  "source_app",
];

const TBL = tableName(HEALTH_FACET_SCHEMA);

export interface HealthFacetStore {
  /** Create the facet table if absent (idempotent). */
  ensure(): Promise<void>;
  /** Every facet row. */
  list(): Promise<HealthFacet[]>;
  /** One person's facet, or null. */
  get(personKey: string): Promise<HealthFacet | null>;
  /** Insert/replace a person's facet row (stamps source_app + updated_at). */
  upsert(facet: HealthFacet): Promise<void>;
  /** Delete a person's facet row. */
  remove(personKey: string): Promise<void>;
}

/**
 * A handle on myHealth's health-facet table bound to an injected SqlDb. Writes stamp
 * `source_app` and `updated_at`. Pure local SQLite — no network, no egress.
 */
export function createHealthFacetStore(db: SqlDb): HealthFacetStore {
  return {
    async ensure() {
      for (const sql of createTableSql(HEALTH_FACET_SCHEMA)) await db.execute(sql);
    },
    async list() {
      return db.select<HealthFacet>(`SELECT * FROM "${TBL}" ORDER BY person_key ASC`);
    },
    async get(personKey) {
      const rows = await db.select<HealthFacet>(
        `SELECT * FROM "${TBL}" WHERE person_key = ? LIMIT 1`,
        [personKey],
      );
      return rows[0] ?? null;
    },
    async upsert(facet) {
      const row: HealthFacet = {
        ...facet,
        organ_donor: facet.organ_donor ? 1 : 0,
        is_pet: facet.is_pet ? 1 : 0,
        updated_at: facet.updated_at ?? new Date().toISOString(),
        source_app: APP_ID,
      };
      const cols = COLS.map((c) => `"${c}"`).join(", ");
      const placeholders = COLS.map(() => "?").join(", ");
      await db.execute(`INSERT OR REPLACE INTO "${TBL}" (${cols}) VALUES (${placeholders})`, COLS.map((c) => row[c] ?? null));
    },
    async remove(personKey) {
      await db.execute(`DELETE FROM "${TBL}" WHERE person_key = ?`, [personKey]);
    },
  };
}
