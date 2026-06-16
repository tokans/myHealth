import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ execute: vi.fn(), query: vi.fn() }));

import { execute, query } from "./client";
import {
  listOpenReminders,
  markReminderFired,
  syncDerivedReminders,
  createManualReminder,
  snoozeReminder,
  completeReminder,
  dismissReminder,
} from "./reminders";

const mockExecute = vi.mocked(execute);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockExecute.mockReset();
  mockQuery.mockReset();
});

describe("listOpenReminders", () => {
  it("selects all open reminders ordered by due_date when no profile is given", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listOpenReminders();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("WHERE status = 'open'");
    expect(sql).not.toContain("profile_id");
    expect(sql).toContain("ORDER BY due_date ASC");
    expect(params).toBeUndefined();
  });

  it("scopes to a single profile when given one", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listOpenReminders(5);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("status = 'open' AND profile_id = ?1");
    expect(params).toEqual([5]);
  });
});

describe("markReminderFired", () => {
  it("updates last_fired_on", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await markReminderFired(3, "2026-06-08");
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("SET last_fired_on = ?2");
    expect(params).toEqual([3, "2026-06-08"]);
  });
});

describe("syncDerivedReminders", () => {
  it("upserts each desired reminder then prunes via NOT IN placeholders", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    const desired = [
      { profile_id: 1, source: "task", dedupe_key: "k1", title: "T1", detail: "d1", due_date: "2026-06-08" },
      { profile_id: null, source: "water", dedupe_key: "k2", title: "T2", detail: null, due_date: "2026-06-08" },
    ];
    await syncDerivedReminders(desired as any);

    // 2 upserts + 1 prune
    expect(mockExecute).toHaveBeenCalledTimes(3);

    const [up1Sql, up1Params] = mockExecute.mock.calls[0];
    expect(up1Sql).toContain("INSERT INTO reminders");
    expect(up1Sql).toContain("ON CONFLICT(dedupe_key)");
    expect(up1Params).toEqual([1, "task", "k1", "T1", "d1", "2026-06-08"]);

    const [, up2Params] = mockExecute.mock.calls[1];
    expect(up2Params).toEqual([null, "water", "k2", "T2", null, "2026-06-08"]);

    const [pruneSql, pruneParams] = mockExecute.mock.calls[2];
    expect(pruneSql).toContain("DELETE FROM reminders");
    expect(pruneSql).toContain("dedupe_key NOT IN (?1, ?2)");
    expect(pruneParams).toEqual(["k1", "k2"]);
  });

  it("deletes all open derived reminders when desired is empty", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 0 } as any);
    await syncDerivedReminders([]);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("DELETE FROM reminders WHERE kind = 'derived' AND status = 'open'");
    expect(sql).not.toContain("NOT IN");
    expect(params).toBeUndefined();
  });
});

describe("createManualReminder", () => {
  it("inserts a manual reminder with coalesced optionals", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 8, rowsAffected: 1 } as any);
    const id = await createManualReminder({ title: "Call doctor", due_date: "2026-06-10" });
    expect(id).toBe(8);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT INTO reminders");
    expect(sql).toContain("'manual'");
    expect(params).toEqual([null, "Call doctor", null, "2026-06-10"]);
  });

  it("passes profile_id and detail when given", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 1, rowsAffected: 1 } as any);
    await createManualReminder({ profile_id: 3, title: "T", detail: "d", due_date: "2026-06-10" });
    const [, params] = mockExecute.mock.calls[0];
    expect(params).toEqual([3, "T", "d", "2026-06-10"]);
  });

  it("returns 0 when lastInsertId missing", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    expect(await createManualReminder({ title: "T", due_date: "d" })).toBe(0);
  });
});

describe("snoozeReminder", () => {
  it("sets snoozed_until", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await snoozeReminder(2, "2026-06-12");
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("SET snoozed_until = ?2");
    expect(params).toEqual([2, "2026-06-12"]);
  });
});

describe("completeReminder", () => {
  it("sets status done", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await completeReminder(2);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("SET status = 'done'");
    expect(params).toEqual([2]);
  });
});

describe("dismissReminder", () => {
  it("sets status dismissed", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await dismissReminder(2);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("SET status = 'dismissed'");
    expect(params).toEqual([2]);
  });
});
