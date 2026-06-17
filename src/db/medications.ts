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

/** Editable medication fields shared by the Excel create/update paths. */
export interface MedicationFields {
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
}

/** Insert a fully-specified medication (Excel import, add-new path). */
export async function createMedicationFull(m: MedicationFields): Promise<number> {
  const res = await execute(
    `INSERT INTO ${T.medications} (profile_id, drug, strength, form, schedule, times, prescriber, start_date, end_date, notes, active)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    [m.profile_id, m.drug, m.strength, m.form, m.schedule, m.times, m.prescriber, m.start_date, m.end_date, m.notes, m.active],
  );
  return res.lastInsertId ?? 0;
}

/** Update an existing medication (Excel import, update-by-ID path). */
export async function updateMedication(id: number, m: MedicationFields): Promise<void> {
  await execute(
    `UPDATE ${T.medications} SET profile_id = ?2, drug = ?3, strength = ?4, form = ?5, schedule = ?6,
       times = ?7, prescriber = ?8, start_date = ?9, end_date = ?10, notes = ?11, active = ?12
       WHERE id = ?1`,
    [id, m.profile_id, m.drug, m.strength, m.form, m.schedule, m.times, m.prescriber, m.start_date, m.end_date, m.notes, m.active],
  );
}

export async function archiveMedication(id: number): Promise<void> {
  await execute(`UPDATE ${T.medications} SET active = 0, end_date = date('now') WHERE id = ?1`, [id]);
}
