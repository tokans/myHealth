import { useMemo, useState } from "react";
import { Heart, HeartPulse, LayoutGrid } from "lucide-react";
import {
  SuiteShell,
  TestTierChooser,
  type SuiteNavItem,
  type SuiteAction,
  type TestTierOption,
} from "sharedcorelib/ui";
import { cn } from "@/lib/utils";
import { buildNav, type NavItem } from "@/lib/nav";
import { GATES, gateVisibility, tierVisibility, type EarnedTier, type GatingFlags } from "@/lib/featureGate";
import { useContentTypes } from "@/content/registry";
import { openExternal } from "@/lib/openExternal";
import { openDonatePage } from "@/lib/donate";
import { reachedTier, TIERS } from "@/lib/gamification";
import { tierOverride } from "@/lib/tierOverride";
import { ReportIssueDialog } from "@/components/feedback/ReportIssueDialog";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { useGatingFlags, useGatingStore } from "@/stores/gating.store";
import { useTierStore, selectTier } from "@/stores/tier.store";
import { useMemberSwitch } from "@/lib/useMemberSwitch";

const TIER_LABEL: Record<EarnedTier, string> = {
  tracker: "Tracker",
  caretaker: "Caretaker",
  champion: "Champion",
};

// Dev/test ladder for the floating tier chooser (low → high). Renders nothing outside dev.
const TIER_CHOOSER_OPTIONS: TestTierOption[] = TIERS.map((t) => ({ key: t.key, label: t.label }));

/** Visibility decision for a nav item given the live gating flags (one tier ahead nudges). */
function navState(item: NavItem, flags: GatingFlags) {
  if (item.tier) return tierVisibility(item.tier, flags);
  if (item.gate) return gateVisibility(item.gate, flags);
  return "open" as const;
}

/** One-line lock hint for a nudged item (gate copy, or a tier hint for content tabs). */
function lockHint(item: NavItem): string | undefined {
  if (item.gate) return GATES[item.gate].unlockHint;
  if (item.tier) return `Reach the ${TIER_LABEL[item.tier]} tier to unlock ${item.label}.`;
  return undefined;
}

/** The engagement-tier badge, shown next to the profile avatar in the top bar. */
function TierBadge() {
  const tier = useTierStore(selectTier);
  const Icon = tier.icon;
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-accent/40 px-2.5 py-1 text-xs">
      <Icon className={cn("h-3.5 w-3.5", tier.className)} />
      <span className="font-medium">{tier.label}</span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const flags = useGatingFlags();
  const contentTypes = useContentTypes();
  const tierCtx = useTierStore((s) => s.ctx);
  const [reportOpen, setReportOpen] = useState(false);

  // The "Donate to support" CTA surfaces alongside "Report an issue" once the user has
  // earned their way to the Tracker tier (the 2nd rung) — a calm Starter never sees it.
  // Donating only accelerates the free ladder; it never paywalls the safety floor.
  // Receive-only: the button just opens the hosted page (the signed support file is then
  // imported in Settings → Support myHealth). Mirrors myFinance's Patron CTA placement.
  const showDonate = reachedTier("tracker", tierCtx);

  // PAID (decision 15), ADDITIVE multi-user switch — undefined for free / single-user, so
  // the shell chrome is pixel-identical (invariant 3). This is SEPARATE from the no-login
  // family-profile switcher below (the `profile` slot / ProfileMenu — decision 18), which
  // is unaffected and keeps working exactly as today.
  const userSwitch = useMemberSwitch();

  // Dev-only tier chooser: pick any tier, then re-derive the live tier + gating pictures.
  // `tierOverride.set` (done inside the chooser) persists the choice before these refresh.
  const applyTierOverride = async () => {
    await Promise.all([useTierStore.getState().refresh(), useGatingStore.getState().refresh()]);
  };

  // Static nav with the dynamic content tabs (Yoga, Exercises, …) spliced in. Rebuilt only
  // when the content types change (not on every render).
  const allNav = useMemo(() => buildNav(contentTypes), [contentTypes]);

  // Visible nav (drop "hidden" items), with the precomputed open/nudge state the shell needs.
  // Recomputed only when the nav set or the gating flag VALUES change (rare), not on every
  // store touch — the two tree-walks below used to run on every refresh().
  const nav: SuiteNavItem[] = useMemo(
    () =>
      allNav
        .map((it) => ({ it, state: navState(it, flags) }))
        .filter(({ state }) => state !== "hidden")
        .map(({ it, state }) => ({
          to: it.to,
          label: it.label,
          icon: it.icon,
          home: it.to === "/",
          end: it.to === "/",
          state: state as "open" | "nudge",
          lockHint: state === "nudge" ? lockHint(it) : undefined,
        })),
    [allNav, flags],
  );

  // Mobile center button = the raised heart FAB → a bottom sheet of the `central` destinations
  // (Reminders / Goals / Schedule + content tabs). Gated items appear only once unlocked ("open");
  // while locked they stay in "More" as a nudge. The shell renders 1 action as a plain button, 2+ as the FAB.
  const centralActions: SuiteAction[] = useMemo(
    () =>
      allNav
        .filter((it) => it.central && navState(it, flags) === "open")
        .map((it) => ({ key: it.to, label: it.label, icon: it.icon, to: it.to })),
    [allNav, flags],
  );

  // Report an issue is suite-standard chrome rendered by SuiteShell itself (`onReportIssue`),
  // and these app-specific actions render right after it (More drawer + sidebar footer).
  const actions: SuiteAction[] = [
    ...(showDonate
      ? [{ key: "donate", label: "Donate to support", icon: Heart, onSelect: () => void openDonatePage(), tone: "primary" as const }]
      : []),
    { key: "apps", label: "Apps", icon: LayoutGrid, to: "/apps" },
  ];

  return (
    <>
      <SuiteShell
        brand={
          <>
            <HeartPulse className="h-5 w-5 text-primary" />
            myHealth
          </>
        }
        nav={nav}
        centralActions={centralActions}
        centralLabel="Health"
        centralIcon={HeartPulse}
        onReportIssue={() => setReportOpen(true)}
        actions={actions}
        userSwitch={userSwitch}
        profile={
          <div className="flex items-center gap-2">
            <TierBadge />
            <ProfileMenu onReport={() => setReportOpen(true)} />
          </div>
        }
        onExternal={(href) => void openExternal(href)}
        contentClassName="mx-auto max-w-3xl"
      >
        {children}
      </SuiteShell>
      <ReportIssueDialog open={reportOpen} onOpenChange={setReportOpen} />
      <TestTierChooser
        override={tierOverride}
        options={TIER_CHOOSER_OPTIONS}
        current={tierOverride.get()}
        onApply={applyTierOverride}
      />
    </>
  );
}
