import { execute, query } from "./client";

export type DocType =
  | "prescription"
  | "lab_report"
  | "discharge"
  | "imaging"
  | "insurance"
  | "bill"
  | "id"
  | "other";

export interface DocumentRow {
  id: number;
  profile_id: number | null;
  doc_type: DocType;
  title: string;
  provider: string | null;
  doc_date: string | null;
  file_name: string;
  mime: string | null;
  size_bytes: number | null;
  extracted_text: string | null;
  created_at: string;
}

export async function listDocuments(profileId?: number): Promise<DocumentRow[]> {
  if (profileId != null) {
    return query<DocumentRow>(
      `SELECT * FROM documents WHERE profile_id = ?1 ORDER BY COALESCE(doc_date, created_at) DESC`,
      [profileId],
    );
  }
  return query<DocumentRow>(`SELECT * FROM documents ORDER BY COALESCE(doc_date, created_at) DESC`);
}

export async function addDocument(d: {
  profile_id?: number | null;
  doc_type: DocType;
  title: string;
  provider?: string;
  doc_date?: string;
  file_name: string;
  mime?: string;
  size_bytes?: number;
}): Promise<number> {
  const res = await execute(
    `INSERT INTO documents (profile_id, doc_type, title, provider, doc_date, file_name, mime, size_bytes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    [
      d.profile_id ?? null,
      d.doc_type,
      d.title,
      d.provider ?? null,
      d.doc_date ?? null,
      d.file_name,
      d.mime ?? null,
      d.size_bytes ?? null,
    ],
  );
  return res.lastInsertId ?? 0;
}

export async function deleteDocument(id: number): Promise<DocumentRow | null> {
  const rows = await query<DocumentRow>(`SELECT * FROM documents WHERE id = ?1`, [id]);
  await execute(`DELETE FROM documents WHERE id = ?1`, [id]);
  return rows[0] ?? null;
}
