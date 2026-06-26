import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ execute: vi.fn(), query: vi.fn() }));

import { execute, query } from "./client";
import {
  listMedications,
  listAllActiveMedications,
  createMedication,
  archiveMedication,
} from "./medications";

const mockExecute = vi.mocked(execute);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockExecute.mockReset();
  mockQuery.mockReset();
});

describe("listMedications", () => {
  it("includes active filter by default", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listMedications(3);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM myhealth_medications");
    expect(sql).toContain("AND active = 1");
    expect(params).toEqual([3]);
  });

  it("omits active filter when activeOnly=false", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listMedications(3, false);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).not.toContain("AND active = 1");
    expect(params).toEqual([3]);
  });
});

describe("listAllActiveMedications", () => {
  it("queries all active rows with no params", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listAllActiveMedications();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("WHERE active = 1");
    expect(params).toBeUndefined();
  });
});

describe("createMedication", () => {
  it("defaults optional fields to null", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 11, rowsAffected: 1 } as any);
    const id = await createMedication({ profile_id: 2, drug: "Aspirin" });
    expect(id).toBe(11);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT INTO myhealth_medications");
    expect(sql).toContain(", active, created_at)"); // active is NOT NULL — supplied as a literal 1
    expect(params).toEqual([
      2, "Aspirin", null, null, null, null, null, null,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    ]);
  });

  it("passes through provided fields", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 1, rowsAffected: 1 } as any);
    await createMedication({
      profile_id: 2,
      drug: "Metformin",
      strength: "500mg",
      form: "tablet",
      schedule: "BID",
      prescriber: "Dr. A",
      notes: "with food",
      start_date: "2026-01-01",
    });
    const [, params] = mockExecute.mock.calls[0];
    expect(params).toEqual([
      2, "Metformin", "500mg", "tablet", "BID", "Dr. A", "with food", "2026-01-01",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    ]);
  });

  it("returns 0 when lastInsertId missing", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    expect(await createMedication({ profile_id: 2, drug: "X" })).toBe(0);
  });
});

describe("archiveMedication", () => {
  it("sets active = 0 and end_date", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await archiveMedication(7);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("UPDATE myhealth_medications SET active = 0");
    expect(sql).toContain("end_date = date('now')");
    expect(params).toEqual([7]);
  });
});
