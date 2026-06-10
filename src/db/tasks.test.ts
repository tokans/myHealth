import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ execute: vi.fn(), query: vi.fn() }));

import { execute, query } from "./client";
import { appliesOn, listTasksForToday, createTask, setTaskDone, archiveTask } from "./tasks";

const mockExecute = vi.mocked(execute);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockExecute.mockReset();
  mockQuery.mockReset();
});

describe("appliesOn", () => {
  it("daily always applies", () => {
    for (let d = 0; d <= 6; d++) expect(appliesOn("daily", d)).toBe(true);
  });

  it("weekdays applies Mon-Fri (1-5) only", () => {
    expect(appliesOn("weekdays", 0)).toBe(false); // Sun
    expect(appliesOn("weekdays", 1)).toBe(true);
    expect(appliesOn("weekdays", 2)).toBe(true);
    expect(appliesOn("weekdays", 3)).toBe(true);
    expect(appliesOn("weekdays", 4)).toBe(true);
    expect(appliesOn("weekdays", 5)).toBe(true);
    expect(appliesOn("weekdays", 6)).toBe(false); // Sat
  });

  it("CSV applies only on listed weekdays", () => {
    expect(appliesOn("1,3,5", 1)).toBe(true);
    expect(appliesOn("1,3,5", 3)).toBe(true);
    expect(appliesOn("1,3,5", 5)).toBe(true);
    expect(appliesOn("1,3,5", 2)).toBe(false);
    expect(appliesOn("1,3,5", 0)).toBe(false);
  });

  it("CSV tolerates surrounding whitespace", () => {
    expect(appliesOn(" 0 , 6 ", 0)).toBe(true);
    expect(appliesOn(" 0 , 6 ", 6)).toBe(true);
    expect(appliesOn(" 0 , 6 ", 3)).toBe(false);
  });

  it("single-value CSV", () => {
    expect(appliesOn("2", 2)).toBe(true);
    expect(appliesOn("2", 3)).toBe(false);
  });
});

describe("listTasksForToday", () => {
  it("filters by appliesOn and annotates done", async () => {
    // 2026-06-08 is a Monday (weekday 1).
    const day = "2026-06-08";
    const tasks = [
      { id: 1, profile_id: 5, title: "Daily", recurrence: "daily", reminder_time: null, active: 1, created_at: "x" },
      { id: 2, profile_id: 5, title: "Weekend", recurrence: "0,6", reminder_time: null, active: 1, created_at: "x" },
      { id: 3, profile_id: 5, title: "Wkdays", recurrence: "weekdays", reminder_time: null, active: 1, created_at: "x" },
    ];
    // First query call -> listTasks; second -> completions.
    mockQuery
      .mockResolvedValueOnce(tasks as any)
      .mockResolvedValueOnce([{ task_id: 1 }] as any);

    const res = await listTasksForToday(5, day);

    // Only daily + weekdays apply on Monday; the weekend task is filtered out.
    expect(res.map((t) => t.id)).toEqual([1, 3]);
    expect(res.find((t) => t.id === 1)!.done).toBe(true);
    expect(res.find((t) => t.id === 3)!.done).toBe(false);

    // listTasks SQL + params
    const [taskSql, taskParams] = mockQuery.mock.calls[0];
    expect(taskSql).toContain("FROM daily_tasks");
    expect(taskSql).toContain("active = 1");
    expect(taskParams).toEqual([5]);

    // completions SQL + params keyed on the day
    const [doneSql, doneParams] = mockQuery.mock.calls[1];
    expect(doneSql).toContain("FROM task_completions");
    expect(doneSql).toContain("done_on = ?1");
    expect(doneParams).toEqual([day]);
  });
});

describe("createTask", () => {
  it("inserts with explicit recurrence + reminder_time", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 9, rowsAffected: 1 } as any);
    const id = await createTask({ profile_id: 2, title: "Walk", recurrence: "weekdays", reminder_time: "08:00" });
    expect(id).toBe(9);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT INTO daily_tasks");
    expect(params).toEqual([2, "Walk", "weekdays", "08:00"]);
  });

  it("defaults recurrence to 'daily' and reminder_time to null", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 1, rowsAffected: 1 } as any);
    await createTask({ profile_id: 2, title: "Walk" });
    const [, params] = mockExecute.mock.calls[0];
    expect(params).toEqual([2, "Walk", "daily", null]);
  });

  it("returns 0 when lastInsertId is undefined", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    expect(await createTask({ profile_id: 2, title: "Walk" })).toBe(0);
  });
});

describe("setTaskDone", () => {
  it("inserts a completion when done=true", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await setTaskDone(7, true, "2026-06-08");
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT OR IGNORE INTO task_completions");
    expect(params).toEqual([7, "2026-06-08"]);
  });

  it("deletes a completion when done=false", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await setTaskDone(7, false, "2026-06-08");
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("DELETE FROM task_completions");
    expect(params).toEqual([7, "2026-06-08"]);
  });
});

describe("archiveTask", () => {
  it("sets active = 0", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await archiveTask(4);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("UPDATE daily_tasks SET active = 0");
    expect(params).toEqual([4]);
  });
});
