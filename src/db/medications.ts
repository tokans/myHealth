import { execute, query } from "./client";
import { T } from "./tables";

export interface Medication {
  id: number;
  profile_id: number;
  drug: string;
  strength: string | null;
  form: string | null;
  schedule: string | null;
  times: string | null;
  prescriber: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  active: number;
  created_at: string;
}

export async function listMedications(profileId: number, activeOnly = true): Promise<Medication[]> {
  return query<Medication>(
    `SELECT * FROM ${T.medications} WHERE profile_id = ?1 ${activeOnly ? "AND active = 1" : ""} ORDER BY drug ASC`,
    [profileId],
  );
}

/** Active medications across all profiles — for the reminder sweep. */
export async function listAllActiveMedications(): Promise<Medication[]> {
  return query<Medication>(`SELECT * FROM ${T.medications} WHERE active = 1`);
}

export async function createMedication(m: {
  profile_id: number;
  drug: string;
  strength?: string;
  form?: string;
  schedule?: string;
  prescriber?: string;
  notes?: string;
  start_date?: string;
}): Promise<number> {
  const res = await execute(
    `INSERT INTO ${T.medications} (profile_id, drug, strength, form, schedule, prescriber, notes, start_date)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    [
      m.profile_id,
      m.drug,
      m.strength ?? null,
      m.form ?? null,
      m.schedule ?? null,
      m.prescriber ?? null,
      m.notes ?? null,
      m.start_date ?? null,
    ],
  );
  return res.lastInsertId ?? 0;
}

export async function archiveMedication(id: number): Promise<void> {
  await execute(`UPDATE ${T.medications} SET active = 0, end_date = date('now') WHERE id = ?1`, [id]);
}
