import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ execute: vi.fn(), query: vi.fn() }));

import { execute, query } from "./client";
import { listDocuments, addDocument, deleteDocument } from "./documents";

const mockExecute = vi.mocked(execute);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockExecute.mockReset();
  mockQuery.mockReset();
});

describe("listDocuments", () => {
  it("filters by profileId when provided", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listDocuments(3);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM documents");
    expect(sql).toContain("WHERE profile_id = ?1");
    expect(params).toEqual([3]);
  });

  it("lists all documents when profileId omitted (no params)", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listDocuments();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM documents");
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
  it("null-coalesces optionals and returns lastInsertId", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 7, rowsAffected: 1 } as any);
    const id = await addDocument({ doc_type: "bill", title: "T", file_name: "f" });
    expect(id).toBe(7);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT INTO documents");
    expect(params).toEqual([null, "bill", "T", null, null, "f", null, null]);
  });

  it("passes through all provided fields", async () => {
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
    });
    expect(id).toBe(12);
    const [, params] = mockExecute.mock.calls[0];
    expect(params).toEqual([4, "lab_report", "CBC", "Acme Lab", "2026-01-02", "cbc.pdf", "application/pdf", 1024]);
  });

  it("returns 0 when lastInsertId is undefined", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    expect(await addDocument({ doc_type: "other", title: "T", file_name: "f" })).toBe(0);
  });
});

describe("deleteDocument", () => {
  it("returns the row then deletes it", async () => {
    const row = { id: 5, doc_type: "id", title: "Passport", file_name: "p.jpg" };
    mockQuery.mockResolvedValue([row] as any);
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);

    const res = await deleteDocument(5);
    expect(res).toEqual(row);

    const [selSql, selParams] = mockQuery.mock.calls[0];
    expect(selSql).toContain("SELECT * FROM documents WHERE id = ?1");
    expect(selParams).toEqual([5]);

    const [delSql, delParams] = mockExecute.mock.calls[0];
    expect(delSql).toContain("DELETE FROM documents WHERE id = ?1");
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
