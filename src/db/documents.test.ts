import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ execute: vi.fn(), query: vi.fn() }));
// Keep the wrapper pure: stub the vault-backed sealing so tests don't need an unlocked
// vault. seal returns a marker; open echoes the stored value back (so decrypt is visible).
vi.mock("./sealedText", () => ({
  sealExtractedText: vi.fn(async (plain: string | null) => (plain == null || plain === "" ? null : `scv1:SEALED(${plain})`)),
  openExtractedText: vi.fn(async (stored: string | null) =>
    stored && stored.startsWith("scv1:SEALED(") ? stored.slice("scv1:SEALED(".length, -1) : stored,
  ),
}));

import { execute, query } from "./client";
import { listDocuments, addDocument, deleteDocument, setExtractedText } from "./documents";

const mockExecute = vi.mocked(execute);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockExecute.mockReset();
  mockQuery.mockReset();
});

describe("listDocuments", () => {
  it("filters by profileId when provided and decrypts extracted text", async () => {
    mockQuery.mockResolvedValue([
      { id: 1, file_name: "f", extracted_text_enc: "scv1:SEALED(hello)" },
    ] as any);
    const rows = await listDocuments(3);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM myhealth_documents");
    expect(sql).toContain("WHERE profile_id = ?1");
    expect(params).toEqual([3]);
    // sealed column is decrypted into plaintext `extracted_text`, enc column dropped.
    expect(rows[0]!.extracted_text).toBe("hello");
    expect((rows[0] as any).extracted_text_enc).toBeUndefined();
  });

  it("lists all documents when profileId omitted (no params)", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listDocuments();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM myhealth_documents");
    expect(sql).not.toContain("WHERE profile_id");
    expect(params).toBeUndefined();
  });

  it("treats profileId 0 as a filter (not null check)", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listDocuments(0);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("WHERE profile_id = ?1");
    expect(params).toEqual([0]);
  });
});

describe("addDocument", () => {
  it("null-coalesces optionals, seals null extracted text, returns lastInsertId", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 7, rowsAffected: 1 } as any);
    const id = await addDocument({ doc_type: "bill", title: "T", file_name: "f" });
    expect(id).toBe(7);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT INTO myhealth_documents");
    // 9th param is the sealed extracted text (null when absent).
    expect(params).toEqual([null, "bill", "T", null, null, "f", null, null, null]);
  });

  it("passes through all provided fields and seals extracted text", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 12, rowsAffected: 1 } as any);
    const id = await addDocument({
      profile_id: 4,
      doc_type: "lab_report",
      title: "CBC",
      provider: "Acme Lab",
      doc_date: "2026-01-02",
      file_name: "cbc.pdf",
      mime: "application/pdf",
      size_bytes: 1024,
      extracted_text: "WBC 6.1",
    });
    expect(id).toBe(12);
    const [, params] = mockExecute.mock.calls[0];
    expect(params).toEqual([
      4,
      "lab_report",
      "CBC",
      "Acme Lab",
      "2026-01-02",
      "cbc.pdf",
      "application/pdf",
      1024,
      "scv1:SEALED(WBC 6.1)",
    ]);
  });

  it("returns 0 when lastInsertId is undefined", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    expect(await addDocument({ doc_type: "other", title: "T", file_name: "f" })).toBe(0);
  });
});

describe("setExtractedText", () => {
  it("seals and updates the enc column for an existing document", async () => {
    mockQuery.mockResolvedValue([{ file_name: "blob-1" }] as any);
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await setExtractedText(9, "secret note");
    const [updSql, updParams] = mockExecute.mock.calls[0];
    expect(updSql).toContain("UPDATE myhealth_documents SET extracted_text_enc");
    expect(updParams).toEqual([9, "scv1:SEALED(secret note)"]);
  });

  it("no-ops when the document does not exist", async () => {
    mockQuery.mockResolvedValue([] as any);
    await setExtractedText(404, "x");
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

describe("deleteDocument", () => {
  it("returns the decrypted row then deletes it", async () => {
    mockQuery.mockResolvedValue([
      { id: 5, doc_type: "id", title: "Passport", file_name: "p.jpg", extracted_text_enc: null },
    ] as any);
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);

    const res = await deleteDocument(5);
    expect(res!.id).toBe(5);
    expect(res!.extracted_text).toBeNull();

    const [selSql, selParams] = mockQuery.mock.calls[0];
    expect(selSql).toContain("FROM myhealth_documents WHERE id = ?1");
    expect(selParams).toEqual([5]);

    const [delSql, delParams] = mockExecute.mock.calls[0];
    expect(delSql).toContain("DELETE FROM myhealth_documents WHERE id = ?1");
    expect(delParams).toEqual([5]);
  });

  it("returns null when no row exists (but still issues delete)", async () => {
    mockQuery.mockResolvedValue([] as any);
    mockExecute.mockResolvedValue({ rowsAffected: 0 } as any);
    const res = await deleteDocument(99);
    expect(res).toBeNull();
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});
