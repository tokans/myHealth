import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// The real selectActiveProfile is a plain function over state; we re-implement a
// fake one so we can control what the hook resolves to without touching the DB.
vi.mock("@/stores/profile.store", () => ({
  useProfileStore: vi.fn(),
  selectActiveProfile: (s: any) => s.profiles.find((p: any) => p.id === s.activeId) ?? null,
}));

import { useActiveProfile } from "./useActiveProfile";
import { useProfileStore } from "@/stores/profile.store";

const refresh = vi.fn(() => Promise.resolve());

/** Make the mocked store run the given selector against `state`. */
function mockState(state: any) {
  (useProfileStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (selector: any) => selector(state),
  );
}

describe("useActiveProfile", () => {
  beforeEach(() => {
    refresh.mockClear();
    (useProfileStore as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it("returns the resolved active profile and loading flag", () => {
    const self = { id: 1, name: "Me", is_self: true };
    mockState({
      profiles: [self, { id: 2, name: "Kid", is_self: false }],
      activeId: 1,
      loaded: true,
      loading: false,
      refresh,
    });

    const { result } = renderHook(() => useActiveProfile());
    expect(result.current.profile).toEqual(self);
    expect(result.current.loading).toBe(false);
  });

  it("resolves the active profile when a non-self id is active", () => {
    const kid = { id: 2, name: "Kid", is_self: false };
    mockState({
      profiles: [{ id: 1, name: "Me", is_self: true }, kid],
      activeId: 2,
      loaded: true,
      loading: false,
      refresh,
    });

    const { result } = renderHook(() => useActiveProfile());
    expect(result.current.profile).toEqual(kid);
  });

  it("triggers refresh() when not yet loaded", async () => {
    mockState({
      profiles: [],
      activeId: null,
      loaded: false,
      loading: true,
      refresh,
    });

    renderHook(() => useActiveProfile());
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("does NOT call refresh() once loaded", () => {
    mockState({
      profiles: [],
      activeId: null,
      loaded: true,
      loading: false,
      refresh,
    });

    renderHook(() => useActiveProfile());
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns null profile during onboarding / browser preview", () => {
    mockState({
      profiles: [],
      activeId: null,
      loaded: true,
      loading: false,
      refresh,
    });

    const { result } = renderHook(() => useActiveProfile());
    expect(result.current.profile).toBeNull();
  });
});
