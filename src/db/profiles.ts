/**
 * Health profiles, spine-backed (K1 consolidation, invariant 6).
 *
 * The legacy flat `profiles` table is GONE. Identity lives on the shared `common_person`
 * spine; the medical fields live on `myhealth_health_facet`; the historical integer
 * profile id ↔ person_key mapping (plus two app-local extras, photo_ref + the ICE
 * emergency-contact display name) lives in the thin `myhealth_profiles` link table.
 *
 * This wrapper keeps the historical flat `Profile` contract for the stores/pages: reads
 * JOIN link + person + facet back into the flat shape; writes fan out to the three tables.
 * `is_self` is derived from `common_person.relationship_to_self = 'self'`. No data egresses
 * — all local SQLite in suite.db.
 */
import { execute, query } from "./client";
import { T } from "./tables";

export interface Profile {
  id: number;
  name: string;
  relationship: string | null;
  is_self: number;
  dob: string | null;
  sex: "female" | "male" | "other" | "unspecified";
  blood_group: string | null;
  height_cm: number | null;
  photo_ref: string | null;
  notes: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  emergency_email: string | null;
  organ_donor: number;
  advance_directive: string | null;
  created_at: string;
}

export interface EmergencyInfo {
  emergency_contact: string | null;
  emergency_phone: string | null;
  emergency_email: string | null;
  organ_donor: number;
  advance_directive: string | null;
}

export type NewProfile = Pick<Profile, "name"> &
  Partial<Pick<Profile, "relationship" | "is_self" | "dob" | "sex" | "blood_group" | "height_cm" | "notes">>;

/**
 * The flat `Profile` projection over link (p) + spine person (pr) + medical facet (f).
 * COALESCE keeps the historical defaults ('unspecified' sex, 0 organ_donor).
 */
const PROFILE_SELECT = `
  SELECT
    p.id                                               AS id,
    pr.display_name                                    AS name,
    pr.relationship_to_self                            AS relationship,
    CASE WHEN pr.relationship_to_self = 'self' THEN 1 ELSE 0 END AS is_self,
    pr.dob                                             AS dob,
    COALESCE(f.sex, 'unspecified')                     AS sex,
    f.blood_group                                      AS blood_group,
    f.height_cm                                        AS height_cm,
    p.photo_ref                                        AS photo_ref,
    f.notes                                            AS notes,
    p.emergency_contact                                AS emergency_contact,
    pr.contact_phone                                   AS emergency_phone,
    pr.contact_email                                   AS emergency_email,
    COALESCE(f.organ_donor, 0)                         AS organ_donor,
    f.advance_directive                                AS advance_directive,
    p.created_at                                       AS created_at
  FROM ${T.profiles} p
  JOIN common_person pr ON pr.person_key = p.person_key
  LEFT JOIN myhealth_health_facet f ON f.person_key = p.person_key`;

export async function listProfiles(): Promise<Profile[]> {
  return query<Profile>(`${PROFILE_SELECT} ORDER BY is_self DESC, name ASC`);
}

export async function getSelfProfile(): Promise<Profile | null> {
  const rows = await query<Profile>(`${PROFILE_SELECT} WHERE pr.relationship_to_self = 'self' LIMIT 1`);
  return rows[0] ?? null;
}

export async function countProfiles(): Promise<number> {
  const rows = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${T.profiles}`);
  return rows[0]?.n ?? 0;
}

export async function getProfile(id: number): Promise<Profile | null> {
  const rows = await query<Profile>(`${PROFILE_SELECT} WHERE p.id = ?1 LIMIT 1`, [id]);
  return rows[0] ?? null;
}

/** Insert a person on the spine + a medical facet + the thin link row; returns the link id. */
export async function createProfile(p: NewProfile): Promise<number> {
  const isSelf = (p.is_self ?? 0) === 1;
  const now = new Date().toISOString();
  // Reserve the integer link id first (AUTOINCREMENT), then derive a stable person_key.
  const linkRes = await execute(
    `INSERT INTO ${T.profiles} (person_key, created_at) VALUES (?1, ?2)`,
    [`__pending__${now}`, now],
  );
  const id = linkRes.lastInsertId ?? 0;
  const personKey = isSelf ? "self" : `mhp-${id}`;
  await execute(`UPDATE ${T.profiles} SET person_key = ?2 WHERE id = ?1`, [id, personKey]);

  // Spine identity (contact lives on person — the ICE/finance precedent).
  await execute(
    `INSERT INTO common_person (person_key, display_name, relationship_to_self, dob, updated_at, source_app)
     VALUES (?1, ?2, ?3, ?4, ?5, 'myhealth')
     ON CONFLICT(person_key) DO UPDATE SET
       display_name = excluded.display_name,
       relationship_to_self = excluded.relationship_to_self,
       dob = excluded.dob,
       updated_at = excluded.updated_at,
       source_app = 'myhealth'`,
    [personKey, p.name, isSelf ? "self" : p.relationship ?? null, p.dob ?? null, now],
  );

  // Medical facet (the fields myHealth owns).
  await execute(
    `INSERT INTO myhealth_health_facet (person_key, sex, blood_group, height_cm, notes, organ_donor, is_pet, updated_at, source_app)
     VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, ?6, 'myhealth')
     ON CONFLICT(person_key) DO UPDATE SET
       sex = excluded.sex,
       blood_group = excluded.blood_group,
       height_cm = excluded.height_cm,
       notes = excluded.notes,
       updated_at = excluded.updated_at,
       source_app = 'myhealth'`,
    [personKey, p.sex ?? "unspecified", p.blood_group ?? null, p.height_cm ?? null, p.notes ?? null, now],
  );
  return id;
}

export async function deleteProfile(id: number): Promise<void> {
  // Resolve the person_key before deleting the link row (its DELETE trigger cascades to
  // the app's per-profile tables — see auxMigrations.ts).
  const rows = await query<{ person_key: string }>(`SELECT person_key FROM ${T.profiles} WHERE id = ?1`, [id]);
  const personKey = rows[0]?.person_key;
  await execute(`DELETE FROM ${T.profiles} WHERE id = ?1`, [id]);
  if (personKey) {
    await execute(`DELETE FROM myhealth_health_facet WHERE person_key = ?1`, [personKey]);
    await execute(`DELETE FROM common_person WHERE person_key = ?1`, [personKey]);
  }
}

export async function updateEmergency(id: number, e: EmergencyInfo): Promise<void> {
  const rows = await query<{ person_key: string }>(`SELECT person_key FROM ${T.profiles} WHERE id = ?1`, [id]);
  const personKey = rows[0]?.person_key;
  if (!personKey) return;
  const now = new Date().toISOString();
  // ICE contact display name is the app-local extra on the link row.
  await execute(`UPDATE ${T.profiles} SET emergency_contact = ?2 WHERE id = ?1`, [id, e.emergency_contact ?? null]);
  // Contact phone/email live on the spine person.
  await execute(
    `UPDATE common_person SET contact_phone = ?2, contact_email = ?3, updated_at = ?4, source_app = 'myhealth' WHERE person_key = ?1`,
    [personKey, e.emergency_phone ?? null, e.emergency_email ?? null, now],
  );
  // organ_donor + advance_directive are medical facet fields.
  await execute(
    `UPDATE myhealth_health_facet SET organ_donor = ?2, advance_directive = ?3, updated_at = ?4, source_app = 'myhealth' WHERE person_key = ?1`,
    [personKey, e.organ_donor ? 1 : 0, e.advance_directive ?? null, now],
  );
}
