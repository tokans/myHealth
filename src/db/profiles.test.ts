import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ execute: vi.fn(), query: vi.fn() }));

import { execute, query } from "./client";
import {
  listProfiles,
  getSelfProfile,
  countProfiles,
  createProfile,
  getProfile,
  updateEmergency,
} from "./profiles";

const mockExecute = vi.mocked(execute);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockExecute.mockReset();
  mockQuery.mockReset();
});

describe("listProfiles", () => {
  it("orders self first then by name", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listProfiles();
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM profiles");
    expect(sql).toContain("ORDER BY is_self DESC, name ASC");
  });
});

describe("getSelfProfile", () => {
  it("returns the row when present", async () => {
    const row = { id: 1, name: "Me", is_self: 1 };
    mockQuery.mockResolvedValue([row] as any);
    expect(await getSelfProfile()).toEqual(row);
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("WHERE is_self = 1");
  });

  it("returns null when empty", async () => {
    mockQuery.mockResolvedValue([] as any);
    expect(await getSelfProfile()).toBeNull();
  });
});

describe("countProfiles", () => {
  it("returns the count", async () => {
    mockQuery.mockResolvedValue([{ n: 3 }] as any);
    expect(await countProfiles()).toBe(3);
  });

  it("returns 0 when empty", async () => {
    mockQuery.mockResolvedValue([] as any);
    expect(await countProfiles()).toBe(0);
  });
});

describe("createProfile", () => {
  it("applies defaults: is_self 0, sex 'unspecified', null optionals", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 6, rowsAffected: 1 } as any);
    const id = await createProfile({ name: "Kid" });
    expect(id).toBe(6);
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("INSERT INTO profiles");
    expect(params).toEqual(["Kid", null, 0, null, "unspecified", null, null, null]);
  });

  it("passes through provided values", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 1, rowsAffected: 1 } as any);
    await createProfile({
      name: "Me",
      relationship: "self",
      is_self: 1,
      dob: "1990-01-01",
      sex: "male",
      blood_group: "O+",
      height_cm: 180,
      notes: "n",
    });
    const [, params] = mockExecute.mock.calls[0];
    expect(params).toEqual(["Me", "self", 1, "1990-01-01", "male", "O+", 180, "n"]);
  });

  it("returns 0 when lastInsertId missing", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    expect(await createProfile({ name: "X" })).toBe(0);
  });
});

describe("getProfile", () => {
  it("returns the row when present", async () => {
    const row = { id: 9, name: "A" };
    mockQuery.mockResolvedValue([row] as any);
    expect(await getProfile(9)).toEqual(row);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("WHERE id = ?1");
    expect(params).toEqual([9]);
  });

  it("returns null when empty", async () => {
    mockQuery.mockResolvedValue([] as any);
    expect(await getProfile(9)).toBeNull();
  });
});

describe("updateEmergency", () => {
  it("coerces organ_donor true -> 1 and coalesces nulls", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await updateEmergency(2, {
      emergency_contact: "Jane",
      emergency_phone: null,
      emergency_email: null,
      organ_donor: 1,
      advance_directive: null,
    });
    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toContain("UPDATE profiles SET");
    expect(params).toEqual([2, "Jane", null, null, 1, null]);
  });

  it("coerces organ_donor falsy -> 0", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await updateEmergency(2, {
      emergency_contact: null,
      emergency_phone: null,
      emergency_email: null,
      organ_donor: 0,
      advance_directive: "DNR",
    });
    const [, params] = mockExecute.mock.calls[0];
    expect(params).toEqual([2, null, null, null, 0, "DNR"]);
  });
});
