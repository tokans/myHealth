import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ execute: vi.fn(), query: vi.fn() }));

import { execute, query } from "./client";
import { listGoals, createGoal, archiveGoal, countGoals } from "./goals";

const mockExecute = vi.mocked(execute);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockExecute.mockReset();
  mockQuery.mockReset();
});

describe("listGoals", () => {
  it("excludes archived and orders by created_at desc", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listGoals(4);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM myhealth_goals");
    expect(sql).toContain("status != 'archived'");
    expect(sql).toContain("ORDER BY created_at DESC");
    expect(params).toEqual([4]);
  });
});

describe("createGoal", () => {
  it("defaults direction to 'decrease' and null optionals", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 10, rowsAffected: 1 } as any);
    const id = await createGoal({ profile_id: 1, kind: "weight", title: "Lose 5kg" });
    expect(id).toBe(10);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT INTO myhealth_goals");
    expect(params).toEqual([1, "weight", "Lose 5kg", null, null, null, null, "decrease", null]);
  });

  it("passes through provided values incl. direction", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 1, rowsAffected: 1 } as any);
    await createGoal({
      profile_id: 1,
      kind: "steps",
      title: "Walk more",
      metric_kind: "steps",
      baseline: 3000,
      target: 8000,
      unit: "steps",
      direction: "increase",
      target_date: "2026-12-01",
    });
    const [, params] = mockExecute.mock.calls[0];
    expect(params).toEqual([1, "steps", "Walk more", "steps", 3000, 8000, "steps", "increase", "2026-12-01"]);
  });

  it("returns 0 when lastInsertId missing", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    expect(await createGoal({ profile_id: 1, kind: "k", title: "t" })).toBe(0);
  });
});

describe("archiveGoal", () => {
  it("sets status archived and archived_at", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await archiveGoal(5);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("status = 'archived'");
    expect(sql).toContain("archived_at = datetime('now')");
    expect(params).toEqual([5]);
  });
});

describe("countGoals", () => {
  it("counts active goals", async () => {
    mockQuery.mockResolvedValue([{ n: 2 }] as any);
    expect(await countGoals()).toBe(2);
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("status = 'active'");
  });

  it("returns 0 when empty", async () => {
    mockQuery.mockResolvedValue([] as any);
    expect(await countGoals()).toBe(0);
  });
});
