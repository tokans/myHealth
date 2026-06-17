/**
 * The PAID multi-user switch affordance for `SuiteShell` (K4, decision 15 + contract
 * `multiuser-activation.md` §3). This is ADDITIVE and STRICTLY SEPARATE from myHealth's
 * existing no-login family-profile switcher (`ProfileMenu` → `ProfileDrawer`, decision
 * 18), which keeps working exactly as today regardless of this hook.
 *
 * Returns a `SuiteUserSwitch` ONLY when the install is BOTH:
 *   1. entitled to the paid multi-user surfaces (Supporter/Pro), AND
 *   2. has more than one member on the person spine.
 * Otherwise it returns `undefined`, so the shell renders no extra chrome — a free,
 * single-primary-user install is pixel-identical to pre-K4 (invariant 3). The shell ALSO
 * self-guards on `members.length > 1`; the entitlement check here is the additional paid
 * gate the contract leaves to the app.
 *
 * Members are sourced from the spine `member_class` (every profile is a `common_person`
 * row). The switch reuses the existing active-profile scoping (`setActive`) so a paid
 * member switch and a free profile switch land on the same person model — the difference
 * is purely that the paid affordance is gated and login-capable (login itself lives in
 * myLifeAssistant, decision 17); here it is the injected switcher slot only.
 */
import { useMemo } from "react";
import type { SuiteUserSwitch } from "sharedcorelib/ui";
import { useTierStore, selectMultiUserEntitled } from "@/stores/tier.store";
import { useProfileStore } from "@/stores/profile.store";

export function useMemberSwitch(): SuiteUserSwitch | undefined {
  const entitled = useTierStore(selectMultiUserEntitled);
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeId);
  const setActive = useProfileStore((s) => s.setActive);

  // Memoize so AppShell receives a stable `userSwitch` reference (and a stable
  // members array) across renders — a fresh object every render would defeat any
  // memoization in SuiteShell and re-map the member list on each shell re-render.
  return useMemo<SuiteUserSwitch | undefined>(() => {
    // Paid gate: free / single-primary-user installs get NO paid switch chrome.
    if (!entitled || profiles.length <= 1) return undefined;
    return {
      current: String(activeId ?? profiles[0]?.id ?? ""),
      members: profiles.map((p) => ({
        key: String(p.id),
        label: p.name,
        avatarText: p.name.trim().charAt(0).toUpperCase() || undefined,
      })),
      onSwitch: (key) => {
        const id = Number(key);
        if (!Number.isNaN(id)) setActive(id);
      },
    };
  }, [entitled, profiles, activeId, setActive]);
}
