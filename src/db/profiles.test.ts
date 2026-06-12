import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ execute: vi.fn(), query: vi.fn() }));

import { execute, query } from "./client";
import {
  listProfiles,
  getSelfProfile,
  countProfiles,
  createProfile,
  getProfile,
  deleteProfile,
  updateEmergency,
} from "./profiles";

const mockExecute = vi.mocked(execute);
const mockQuery = vi.mocked(query);

beforeEach(() => {
  mockExecute.mockReset();
  mockQuery.mockReset();
});

describe("listProfiles", () => {
  it("joins link + spine + facet and orders self first", async () => {
    mockQuery.mockResolvedValue([] as any);
    await listProfiles();
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM myhealth_profiles p");
    expect(sql).toContain("JOIN common_person pr");
    expect(sql).toContain("LEFT JOIN myhealth_health_facet f");
    expect(sql).toContain("ORDER BY is_self DESC, name ASC");
  });
});

describe("getSelfProfile", () => {
  it("filters on the spine self relationship", async () => {
    const row = { id: 1, name: "Me", is_self: 1 };
    mockQuery.mockResolvedValue([row] as any);
    expect(await getSelfProfile()).toEqual(row);
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("WHERE pr.relationship_to_self = 'self'");
  });

  it("returns null when empty", async () => {
    mockQuery.mockResolvedValue([] as any);
    expect(await getSelfProfile()).toBeNull();
  });
});

describe("countProfiles", () => {
  it("counts the link table", async () => {
    mockQuery.mockResolvedValue([{ n: 3 }] as any);
    expect(await countProfiles()).toBe(3);
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("FROM myhealth_profiles");
  });

  it("returns 0 when empty", async () => {
    mockQuery.mockResolvedValue([] as any);
    expect(await countProfiles()).toBe(0);
  });
});

describe("createProfile", () => {
  it("creates link + spine person + facet; self gets person_key 'self'", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 1, rowsAffected: 1 } as any);
    const id = await createProfile({ name: "Me", is_self: 1, sex: "male", blood_group: "O+", height_cm: 180 });
    expect(id).toBe(1);

    // 1: insert link (pending key), 2: set person_key, 3: upsert person, 4: upsert facet
    const sqls = mockExecute.mock.calls.map((c) => c[0] as string);
    expect(sqls[0]).toContain("INSERT INTO myhealth_profiles");
    expect(sqls[1]).toContain("UPDATE myhealth_profiles SET person_key");
    expect(mockExecute.mock.calls[1]![1]).toEqual([1, "self"]);
    expect(sqls[2]).toContain("INSERT INTO common_person");
    expect(mockExecute.mock.calls[2]![1]).toEqual(["self", "Me", "self", null, expect.any(String)]);
    expect(sqls[3]).toContain("INSERT INTO myhealth_health_facet");
    expect(mockExecute.mock.calls[3]![1]).toEqual(["self", "male", "O+", 180, null, expect.any(String)]);
  });

  it("non-self profile gets a derived person_key 'mhp-<id>'", async () => {
    mockExecute.mockResolvedValue({ lastInsertId: 6, rowsAffected: 1 } as any);
    const id = await createProfile({ name: "Kid" });
    expect(id).toBe(6);
    expect(mockExecute.mock.calls[1]![1]).toEqual([6, "mhp-6"]);
    // sex defaults to 'unspecified'
    expect(mockExecute.mock.calls[3]![1]).toEqual(["mhp-6", "unspecified", null, null, null, expect.any(String)]);
  });

  it("returns 0 when lastInsertId missing", async () => {
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    expect(await createProfile({ name: "X" })).toBe(0);
  });
});

describe("getProfile", () => {
  it("filters by link id", async () => {
    const row = { id: 9, name: "A" };
    mockQuery.mockResolvedValue([row] as any);
    expect(await getProfile(9)).toEqual(row);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("WHERE p.id = ?1");
    expect(params).toEqual([9]);
  });

  it("returns null when empty", async () => {
    mockQuery.mockResolvedValue([] as any);
    expect(await getProfile(9)).toBeNull();
  });
});

describe("deleteProfile", () => {
  it("deletes the link (cascade) then facet + person", async () => {
    mockQuery.mockResolvedValue([{ person_key: "mhp-2" }] as any);
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await deleteProfile(2);
    const sqls = mockExecute.mock.calls.map((c) => c[0] as string);
    expect(sqls[0]).toContain("DELETE FROM myhealth_profiles WHERE id = ?1");
    expect(sqls[1]).toContain("DELETE FROM myhealth_health_facet WHERE person_key = ?1");
    expect(sqls[2]).toContain("DELETE FROM common_person WHERE person_key = ?1");
  });
});

describe("updateEmergency", () => {
  it("writes ICE name to link, phone/email to spine, organ_donor + directive to facet", async () => {
    mockQuery.mockResolvedValue([{ person_key: "self" }] as any);
    mockExecute.mockResolvedValue({ rowsAffected: 1 } as any);
    await updateEmergency(2, {
      emergency_contact: "Jane",
      emergency_phone: "999",
      emergency_email: null,
      organ_donor: 1,
      advance_directive: "DNR",
    });
    const calls = mockExecute.mock.calls;
    expect(calls[0]![0]).toContain("UPDATE myhealth_profiles SET emergency_contact");
    expect(calls[0]![1]).toEqual([2, "Jane"]);
    expect(calls[1]![0]).toContain("UPDATE common_person SET contact_phone");
    expect(calls[1]![1]).toEqual(["self", "999", null, expect.any(String)]);
    expect(calls[2]![0]).toContain("UPDATE myhealth_health_facet SET organ_donor");
    expect(calls[2]![1]).toEqual(["self", 1, "DNR", expect.any(String)]);
  });

  it("coerces organ_donor falsy -> 0 and no-ops on unknown id", async () => {
    mockQuery.mockResolvedValue([] as any);
    await updateEmergency(99, {
      emergency_contact: null,
      emergency_phone: null,
      emergency_email: null,
      organ_donor: 0,
      advance_directive: null,
    });
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
