/**
 * Medical document metadata wrapper over the suite DB's `myhealth_documents` table.
 *
 * Document BYTES are AES-GCM vault blobs (see vault/stronghold + Documents.tsx); only the
 * opaque `file_name` blob uuid is stored here. `extracted_text` is **vault-sealed at rest**
 * in the `extracted_text_enc` column (decision #26) using the SAME per-device DEK primitive
 * that protects the blob bytes (`vault.sealBytes`/`openBytes`); callers see/provide
 * plaintext and this layer seals on write + opens on read. Sealing/opening needs the vault
 * unlocked — the Documents page is already vault-gated.
 */
import { execute, query } from "./client";
import { T } from "./tables";
import { sealExtractedText, openExtractedText } from "./sealedText";

export type DocType =
  | "prescription"
  | "lab_report"
  | "discharge"
  | "imaging"
  | "insurance"
  | "bill"
  | "id"
  | "other";

/** The plaintext-facing row pages consume (`extracted_text` is decrypted on read). */
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

/** Raw row shape as stored (extracted text is sealed ciphertext). */
interface StoredDocumentRow extends Omit<DocumentRow, "extracted_text"> {
  extracted_text_enc: string | null;
}

/** Decrypt the sealed extracted text on a stored row into the plaintext-facing shape. */
async function decryptRow(r: StoredDocumentRow): Promise<DocumentRow> {
  const { extracted_text_enc, ...rest } = r;
  return { ...rest, extracted_text: await openExtractedText(extracted_text_enc, r.file_name) };
}

const SELECT_COLS =
  "id, profile_id, doc_type, title, provider, doc_date, file_name, mime, size_bytes, extracted_text_enc, created_at";

export async function listDocuments(profileId?: number): Promise<DocumentRow[]> {
  const rows =
    profileId != null
      ? await query<StoredDocumentRow>(
          `SELECT ${SELECT_COLS} FROM ${T.documents} WHERE profile_id = ?1 ORDER BY COALESCE(doc_date, created_at) DESC`,
          [profileId],
        )
      : await query<StoredDocumentRow>(
          `SELECT ${SELECT_COLS} FROM ${T.documents} ORDER BY COALESCE(doc_date, created_at) DESC`,
        );
  return Promise.all(rows.map(decryptRow));
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
  /** Plaintext extracted text; sealed under the per-device DEK before it touches the DB. */
  extracted_text?: string | null;
}): Promise<number> {
  // AAD binds the sealed text to this document's blob uuid (see sealedText.ts).
  const sealed = await sealExtractedText(d.extracted_text ?? null, d.file_name);
  const res = await execute(
    `INSERT INTO ${T.documents}
       (profile_id, doc_type, title, provider, doc_date, file_name, mime, size_bytes, extracted_text_enc)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [
      d.profile_id ?? null,
      d.doc_type,
      d.title,
      d.provider ?? null,
      d.doc_date ?? null,
      d.file_name,
      d.mime ?? null,
      d.size_bytes ?? null,
      sealed,
    ],
  );
  return res.lastInsertId ?? 0;
}

/** Seal + store extracted text for an existing document (e.g. after an OCR import pass). */
export async function setExtractedText(id: number, plain: string | null): Promise<void> {
  const rows = await query<{ file_name: string }>(
    `SELECT file_name FROM ${T.documents} WHERE id = ?1`,
    [id],
  );
  const fileName = rows[0]?.file_name;
  if (!fileName) return;
  const sealed = await sealExtractedText(plain, fileName);
  await execute(`UPDATE ${T.documents} SET extracted_text_enc = ?2 WHERE id = ?1`, [id, sealed]);
}

export async function deleteDocument(id: number): Promise<DocumentRow | null> {
  const rows = await query<StoredDocumentRow>(
    `SELECT ${SELECT_COLS} FROM ${T.documents} WHERE id = ?1`,
    [id],
  );
  await execute(`DELETE FROM ${T.documents} WHERE id = ?1`, [id]);
  return rows[0] ? decryptRow(rows[0]) : null;
}
