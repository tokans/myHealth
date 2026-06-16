import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ execute: vi.fn(), query: vi.fn() }));

import { execute, query } from "./client";
import { listBaseline, addBaseline, deleteBaseline } from "./baseline";

const mockExecute = vi.mocked(execute);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockExecute.mockReset();
  mockQuery.mockReset();
});

describe("listBaseline", () => {
  it("filters by kind when provided", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listBaseline(3, "allergy");
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM myhealth_profile_baseline");
    expect(sql).toContain("AND kind = ?2");
    expect(params).toEqual([3, "allergy"]);
  });

  it("lists all kinds when kind omitted", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listBaseline(3);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).not.toContain("AND kind = ?2");
    expect(sql).toContain("ORDER BY kind, id");
    expect(params).toEqual([3]);
  });
});

describe("addBaseline", () => {
  it("coalesces detail and severity to null", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 5, rowsAffected: 1 } as any);
    const id = await addBaseline({ profile_id: 1, kind: "condition", label: "Asthma" });
    expect(id).toBe(5);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT INTO myhealth_profile_baseline");
    expect(params).toEqual([1, "condition", "Asthma", null, null]);
  });

  it("passes detail and severity when given", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 1, rowsAffected: 1 } as any);
    await addBaseline({ profile_id: 1, kind: "allergy", label: "Peanuts", detail: "anaphylaxis", severity: "severe" });
    const [, params] = mockExecute.mock.calls[0];
    expect(params).toEqual([1, "allergy", "Peanuts", "anaphylaxis", "severe"]);
  });

  it("returns 0 when lastInsertId missing", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    expect(await addBaseline({ profile_id: 1, kind: "lifestyle", label: "x" })).toBe(0);
  });
});

describe("deleteBaseline", () => {
  it("deletes by id", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await deleteBaseline(7);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("DELETE FROM myhealth_profile_baseline WHERE id = ?1");
    expect(params).toEqual([7]);
  });
});
