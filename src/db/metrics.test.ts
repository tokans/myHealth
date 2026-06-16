import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ execute: vi.fn(), query: vi.fn() }));

import { execute, query } from "./client";
import { addMetric, listMetrics, latestMetrics, countMetrics, countDistinctMetricDays } from "./metrics";

const mockExecute = vi.mocked(execute);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockExecute.mockReset();
  mockQuery.mockReset();
});

describe("addMetric", () => {
  it("inserts with 'manual' source and coalesced optionals", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 3, rowsAffected: 1 } as any);
    const id = await addMetric({ profile_id: 1, kind: "weight", value: 80, taken_at: "2026-06-01T08:00:00" });
    expect(id).toBe(3);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT INTO myhealth_metrics");
    expect(sql).toContain("'manual'");
    expect(params).toEqual([1, "weight", 80, null, "2026-06-01T08:00:00", null]);
  });

  it("passes unit and note when provided", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 4, rowsAffected: 1 } as any);
    await addMetric({ profile_id: 1, kind: "weight", value: 79, unit: "kg", taken_at: "t", note: "morning" });
    const [, params] = mockExecute.mock.calls[0];
    expect(params).toEqual([1, "weight", 79, "kg", "t", "morning"]);
  });

  it("returns 0 when lastInsertId missing", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    expect(await addMetric({ profile_id: 1, kind: "x", value: 1, taken_at: "t" })).toBe(0);
  });
});

describe("listMetrics", () => {
  it("queries by profile and kind ordered ascending", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listMetrics(2, "bp");
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM myhealth_metrics");
    expect(sql).toContain("kind = ?2");
    expect(sql).toContain("ORDER BY taken_at ASC");
    expect(params).toEqual([2, "bp"]);
  });
});

describe("latestMetrics", () => {
  it("queries with the MAX(taken_at) join for the profile", async () => {
    mockQuery.mockResolvedValue([] as any);
    await latestMetrics(8);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("MAX(taken_at)");
    expect(params).toEqual([8]);
  });
});

describe("countMetrics", () => {
  it("returns the count", async () => {
    mockQuery.mockResolvedValue([{ n: 42 }] as any);
    expect(await countMetrics()).toBe(42);
  });

  it("returns 0 when rows empty", async () => {
    mockQuery.mockResolvedValue([] as any);
    expect(await countMetrics()).toBe(0);
  });
});

describe("countDistinctMetricDays", () => {
  it("returns the distinct-day count", async () => {
    mockQuery.mockResolvedValue([{ n: 5 }] as any);
    expect(await countDistinctMetricDays()).toBe(5);
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("COUNT(DISTINCT substr(taken_at, 1, 10))");
  });

  it("returns 0 when rows empty", async () => {
    mockQuery.mockResolvedValue([] as any);
    expect(await countDistinctMetricDays()).toBe(0);
  });
});
