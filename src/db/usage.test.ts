import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ execute: vi.fn(), query: vi.fn() }));

import { execute, query } from "./client";
import { recordLaunch, countDistinctLaunchDays } from "./usage";

const mockExecute = vi.mocked(execute);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockExecute.mockReset();
  mockQuery.mockReset();
});

describe("recordLaunch", () => {
  it("upserts the launch day, incrementing opens on conflict", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await recordLaunch();
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT INTO myhealth_app_launches");
    expect(sql).toContain("ON CONFLICT(launch_day) DO UPDATE SET opens = opens + 1");
    // single param: the local day string
    expect(params).toHaveLength(1);
    expect(typeof params![0]).toBe("string");
    expect(params![0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("countDistinctLaunchDays", () => {
  it("returns the count", async () => {
    mockQuery.mockResolvedValue([{ n: 12 }] as any);
    expect(await countDistinctLaunchDays()).toBe(12);
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM myhealth_app_launches");
  });

  it("returns 0 when empty", async () => {
    mockQuery.mockResolvedValue([] as any);
    expect(await countDistinctLaunchDays()).toBe(0);
  });
});
