import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ execute: vi.fn(), query: vi.fn() }));

import { execute, query } from "./client";
import { getWaterDay, addGlasses, setWaterTarget } from "./water";

const mockExecute = vi.mocked(execute);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockExecute.mockReset();
  mockQuery.mockReset();
});

describe("getWaterDay", () => {
  it("returns the row when present", async () => {
    const row = { id: 1, profile_id: 2, day: "2026-06-08", glasses: 3, target_glasses: 8 };
    mockQuery.mockResolvedValue([row] as any);
    const res = await getWaterDay(2, "2026-06-08");
    expect(res).toEqual(row);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM water_log");
    expect(params).toEqual([2, "2026-06-08"]);
  });

  it("returns null when none", async () => {
    mockQuery.mockResolvedValue([] as any);
    expect(await getWaterDay(2, "2026-06-08")).toBeNull();
  });
});

describe("addGlasses", () => {
  it("upserts then returns the new total via a second query", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    mockQuery.mockResolvedValue([{ id: 1, profile_id: 2, day: "2026-06-08", glasses: 4, target_glasses: 8 }] as any);

    const total = await addGlasses(2, 1, 8, "2026-06-08");
    expect(total).toBe(4);

    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT INTO water_log");
    expect(sql).toContain("ON CONFLICT(profile_id, day)");
    expect(params).toEqual([2, "2026-06-08", 1, 8]);

    // second query is getWaterDay
    const [qsql, qparams] = mockQuery.mock.calls[0];
    expect(qsql).toContain("FROM water_log");
    expect(qparams).toEqual([2, "2026-06-08"]);
  });

  it("returns 0 when the row is missing after upsert", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    mockQuery.mockResolvedValue([] as any);
    expect(await addGlasses(2, -1, 8, "2026-06-08")).toBe(0);
  });
});

describe("setWaterTarget", () => {
  it("upserts the target", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await setWaterTarget(2, 10, "2026-06-08");
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT INTO water_log");
    expect(sql).toContain("DO UPDATE SET target_glasses = ?3");
    expect(params).toEqual([2, "2026-06-08", 10]);
  });
});
