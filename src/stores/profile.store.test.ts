import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/environment", () => ({ isTauri: vi.fn(() => true) }));
vi.mock("@/db/profiles", () => ({ listProfiles: vi.fn() }));

import { isTauri } from "@/lib/environment";
import { listProfiles, type Profile } from "@/db/profiles";
import { useProfileStore, selectActiveProfile } from "./profile.store";

const STORAGE_KEY = "myhealth.activeProfileId";

function profile(p: Partial<Profile> & { id: number; name: string }): Profile {
  return {
    relationship: null,
    is_self: 0,
    member_class: null,
    dob: null,
    sex: "unspecified",
    blood_group: null,
    height_cm: null,
    photo_ref: null,
    notes: null,
    emergency_contact: null,
    emergency_phone: null,
    emergency_email: null,
    organ_donor: 0,
    advance_directive: null,
    created_at: "2026-01-01",
    ...p,
  };
}

const self = profile({ id: 1, name: "Me", is_self: 1 });
const child = profile({ id: 2, name: "Kid" });
const partner = profile({ id: 3, name: "Partner" });

beforeEach(() => {
  localStorage.clear();
  vi.mocked(isTauri).mockReturnValue(true);
  // Reset the singleton store to a known clean state before each test.
  useProfileStore.setState({ profiles: [], activeId: null, loading: true, loaded: false });
});

describe("useProfileStore.refresh", () => {
  it("clears state in browser preview (isTauri false)", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    await useProfileStore.getState().refresh();
    const s = useProfileStore.getState();
    expect(s.profiles).toEqual([]);
    expect(s.activeId).toBeNull();
    expect(s.loaded).toBe(true);
    expect(s.loading).toBe(false);
    expect(listProfiles).not.toHaveBeenCalled();
  });

  it("keeps the stored active id when it still exists", async () => {
    localStorage.setItem(STORAGE_KEY, "2");
    useProfileStore.setState({ activeId: 2 });
    vi.mocked(listProfiles).mockResolvedValue([self, child, partner]);
    await useProfileStore.getState().refresh();
    const s = useProfileStore.getState();
    expect(s.activeId).toBe(2);
    expect(s.profiles).toHaveLength(3);
    expect(s.loaded).toBe(true);
  });

  it("falls back to the is_self profile when stored id is missing", async () => {
    localStorage.setItem(STORAGE_KEY, "99");
    useProfileStore.setState({ activeId: 99 });
    vi.mocked(listProfiles).mockResolvedValue([child, self, partner]);
    await useProfileStore.getState().refresh();
    const s = useProfileStore.getState();
    expect(s.activeId).toBe(1); // the is_self profile
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("falls back to the first profile when none is self and nothing stored", async () => {
    vi.mocked(listProfiles).mockResolvedValue([child, partner]);
    await useProfileStore.getState().refresh();
    const s = useProfileStore.getState();
    expect(s.activeId).toBe(2); // first in the list
  });

  it("resolves activeId to null when there are no profiles", async () => {
    vi.mocked(listProfiles).mockResolvedValue([]);
    await useProfileStore.getState().refresh();
    expect(useProfileStore.getState().activeId).toBeNull();
  });
});

describe("useProfileStore.setActive", () => {
  it("updates activeId and persists it to localStorage", () => {
    useProfileStore.getState().setActive(42);
    expect(useProfileStore.getState().activeId).toBe(42);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("42");
  });
});

describe("selectActiveProfile", () => {
  it("resolves the active profile object", () => {
    useProfileStore.setState({ profiles: [self, child], activeId: 2 });
    expect(selectActiveProfile(useProfileStore.getState())).toEqual(child);
  });

  it("returns null when activeId is not found", () => {
    useProfileStore.setState({ profiles: [self, child], activeId: 999 });
    expect(selectActiveProfile(useProfileStore.getState())).toBeNull();
  });

  it("returns null when activeId is null", () => {
    useProfileStore.setState({ profiles: [self], activeId: null });
    expect(selectActiveProfile(useProfileStore.getState())).toBeNull();
  });
});
