/**
 * K4 multi-user activation — free-tier-unchanged + decision-18 coexistence guard.
 *
 * Asserts the INVARIANT-3 / DECISION-18 contract for myHealth:
 *   - free tier (no Supporter/Pro entitlement) with a single primary user mounts NO paid
 *     user-switch chrome (`useMemberSwitch` → undefined), AND
 *   - the existing no-login family-profile switcher (`ProfileMenu` → ProfileDrawer) is
 *     untouched and renders identically whether or not the paid switch is active.
 * Plus the additive paid path: entitled + >1 member yields a `SuiteUserSwitch` sourced
 * from the spine, and the child-soft member policy hides the sensitive-category gates
 * from a child_user while leaving medical gates open.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { render, screen } from "@testing-library/react";

import { useProfileStore } from "@/stores/profile.store";
import { useTierStore } from "@/stores/tier.store";
import { EMPTY_TIER_CONTEXT } from "@/lib/gamification";
import type { Profile } from "@/db/profiles";
import { useMemberSwitch } from "./useMemberSwitch";
import { memberPolicy, GATE_CATEGORIES } from "./memberPolicy";

// ProfileMenu pulls in the ProfileDrawer; mock the drawer so we can render the menu in
// isolation and prove the no-login switcher is untouched.
vi.mock("@/components/layout/ProfileDrawer", () => ({
  ProfileDrawer: () => null,
}));
import { ProfileMenu } from "@/components/layout/ProfileMenu";

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

function setProfiles(profiles: Profile[], activeId: number | null) {
  useProfileStore.setState({ profiles, activeId, loading: false, loaded: true });
}

function setEntitled(entitled: boolean) {
  useTierStore.setState({
    ctx: { ...EMPTY_TIER_CONTEXT, isSupporter: entitled },
    loaded: true,
  });
}

const SELF = profile({ id: 1, name: "Me", is_self: 1, member_class: "owner" });
const CHILD = profile({ id: 2, name: "Kid", member_class: "child_user" });

describe("useMemberSwitch (paid multi-user affordance, K4)", () => {
  beforeEach(() => {
    setProfiles([], null);
    setEntitled(false);
  });

  it("FREE TIER UNCHANGED: no entitlement + single primary user → no paid switch chrome", () => {
    // Invariant 3: a free single-user install passes nothing to the shell's userSwitch.
    setEntitled(false);
    setProfiles([SELF], 1);
    const { result } = renderHook(() => useMemberSwitch());
    expect(result.current).toBeUndefined();
  });

  it("free tier with MULTIPLE family profiles still gets NO paid switch (paid-gated)", () => {
    // Decision 15/18: extra no-login family profiles must NOT trip the paid affordance.
    setEntitled(false);
    setProfiles([SELF, CHILD], 1);
    const { result } = renderHook(() => useMemberSwitch());
    expect(result.current).toBeUndefined();
  });

  it("entitled but single member → still nothing (shell also self-guards on >1)", () => {
    setEntitled(true);
    setProfiles([SELF], 1);
    const { result } = renderHook(() => useMemberSwitch());
    expect(result.current).toBeUndefined();
  });

  it("entitled + >1 member → a SuiteUserSwitch sourced from the spine profiles", () => {
    setEntitled(true);
    setProfiles([SELF, CHILD], 1);
    const { result } = renderHook(() => useMemberSwitch());
    expect(result.current).toBeDefined();
    expect(result.current!.current).toBe("1");
    expect(result.current!.members.map((m) => m.key)).toEqual(["1", "2"]);
    expect(result.current!.members.map((m) => m.label)).toEqual(["Me", "Kid"]);
  });

  it("onSwitch re-scopes the active profile (shares the family-profile model)", () => {
    setEntitled(true);
    setProfiles([SELF, CHILD], 1);
    const { result } = renderHook(() => useMemberSwitch());
    result.current!.onSwitch("2");
    expect(useProfileStore.getState().activeId).toBe(2);
  });
});

describe("DECISION 18 — no-login family-profile switcher preserved", () => {
  beforeEach(() => {
    setProfiles([SELF], 1);
    setEntitled(false);
  });

  it("ProfileMenu renders the no-login switcher identically with the paid switch INERT", () => {
    // Free tier: the paid switch is undefined; the family ProfileMenu is the only person
    // switcher and renders its avatar button exactly as today.
    const { unmount } = render(<ProfileMenu onReport={() => {}} />);
    const btnFree = screen.getByRole("button", { name: "Profiles" });
    expect(btnFree).toBeInTheDocument();
    // Active profile initial is shown ("M" for "Me").
    expect(btnFree).toHaveTextContent("M");
    unmount();

    // Now ENTITLED + multi-member (paid switch active): the no-login ProfileMenu must be
    // byte-identical — the paid affordance is additive and separate (decision 18).
    setEntitled(true);
    setProfiles([SELF, CHILD], 1);
    render(<ProfileMenu onReport={() => {}} />);
    const btnPaid = screen.getByRole("button", { name: "Profiles" });
    expect(btnPaid).toBeInTheDocument();
    expect(btnPaid.outerHTML).toBe(btnFree.outerHTML);
  });
});

describe("child-soft member policy (decision 19, UI-soft)", () => {
  it("owner / free single user is allowed every gate (additive: unchanged)", () => {
    expect(memberPolicy.isFeatureAllowed("owner", "documents", GATE_CATEGORIES.documents)).toBe(true);
    expect(memberPolicy.isFeatureAllowed(null, "documents", GATE_CATEGORIES.documents)).toBe(true);
    expect(memberPolicy.isFeatureAllowed(undefined, "import", GATE_CATEGORIES.import)).toBe(true);
  });

  it("child_user is denied the sensitive-category gates (documents/import → estate)", () => {
    expect(memberPolicy.isFeatureAllowed("child_user", "documents", GATE_CATEGORIES.documents)).toBe(false);
    expect(memberPolicy.isFeatureAllowed("child_user", "import", GATE_CATEGORIES.import)).toBe(false);
  });

  it("child_user keeps MEDICAL gates (untagged) — family-profile model, NOT child-soft hiding", () => {
    // Medical features carry no sensitive category, so a child sees them.
    expect(memberPolicy.isFeatureAllowed("child_user", "metrics", undefined)).toBe(true);
    expect(memberPolicy.isFeatureAllowed("child_user", "medications", undefined)).toBe(true);
    expect(memberPolicy.isFeatureAllowed("child_user", "ice", GATE_CATEGORIES.ice)).toBe(true);
  });

  it("any adult is a co-admin — allowed the sensitive gates", () => {
    expect(memberPolicy.isFeatureAllowed("adult", "documents", GATE_CATEGORIES.documents)).toBe(true);
    expect(memberPolicy.isFeatureAllowed("adult", "import", GATE_CATEGORIES.import)).toBe(true);
  });
});
