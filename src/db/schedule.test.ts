import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ execute: vi.fn(), query: vi.fn() }));

import { execute, query } from "./client";
import { listBlocks, createBlock, deleteBlock } from "./schedule";

const mockExecute = vi.mocked(execute);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockExecute.mockReset();
  mockQuery.mockReset();
});

describe("listBlocks", () => {
  it("queries by profile ordered by start_min then id", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listBlocks(4);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM schedule_blocks");
    expect(sql).toContain("ORDER BY start_min ASC, id ASC");
    expect(params).toEqual([4]);
  });
});

describe("createBlock", () => {
  it("defaults days to 'daily' and end_min to null", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 3, rowsAffected: 1 } as any);
    const id = await createBlock({ profile_id: 1, kind: "meal", title: "Lunch", start_min: 720 });
    expect(id).toBe(3);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT INTO schedule_blocks");
    expect(params).toEqual([1, "meal", "Lunch", 720, null, "daily"]);
  });

  it("passes end_min and days when given", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 1, rowsAffected: 1 } as any);
    await createBlock({ profile_id: 1, kind: "activity", title: "Gym", start_min: 360, end_min: 420, days: "weekdays" });
    const [, params] = mockExecute.mock.calls[0];
    expect(params).toEqual([1, "activity", "Gym", 360, 420, "weekdays"]);
  });

  it("returns 0 when lastInsertId missing", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    expect(await createBlock({ profile_id: 1, kind: "other", title: "x", start_min: 0 })).toBe(0);
  });
});

describe("deleteBlock", () => {
  it("deletes by id", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await deleteBlock(9);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("DELETE FROM schedule_blocks WHERE id = ?1");
    expect(params).toEqual([9]);
  });
});
