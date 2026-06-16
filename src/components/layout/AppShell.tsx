import { useState } from "react";
import { HeartPulse, Settings as SettingsIcon } from "lucide-react";
import { SuiteShell, type SuiteNavItem, type SuiteAction } from "sharedcorelib/ui";
import { cn } from "@/lib/utils";
import { buildNav, type NavItem } from "@/lib/nav";
import { GATES, gateVisibility, tierVisibility, type EarnedTier } from "@/lib/featureGate";
import { useContentTypes } from "@/content/registry";
import { openExternal } from "@/lib/openExternal";
import { ReportIssueDialog } from "@/components/feedback/ReportIssueDialog";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { useGatingStore } from "@/stores/gating.store";
import { useTierStore, selectTier } from "@/stores/tier.store";

const TIER_LABEL: Record<EarnedTier, string> = {
  tracker: "Tracker",
  caretaker: "Caretaker",
  champion: "Champion",
};

/** Visibility decision for a nav item given the live gating flags (one tier ahead nudges). */
function navState(item: NavItem, flags: ReturnType<typeof useGatingStore.getState>) {
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
  const flags = useGatingStore();
  const contentTypes = useContentTypes();
  const [reportOpen, setReportOpen] = useState(false);

  // Static nav with the dynamic content tabs (Yoga, Exercises, …) spliced in.
  const allNav = buildNav(contentTypes);

  // Visible nav (drop "hidden" items), with the precomputed open/nudge state the shell needs.
  const nav: SuiteNavItem[] = allNav
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
    }));

  // Mobile center button = the raised heart FAB → a bottom sheet of the `central` destinations
  // (Reminders / Goals / Schedule + content tabs). Gated items appear only once unlocked ("open");
  // while locked they stay in "More" as a nudge. The shell renders 1 action as a plain button, 2+ as the FAB.
  const centralActions: SuiteAction[] = allNav
    .filter((it) => it.central && navState(it, flags) === "open")
    .map((it) => ({ key: it.to, label: it.label, icon: it.icon, to: it.to }));

  // Report an issue is suite-standard chrome rendered by SuiteShell itself (`onReportIssue`);
  // only app-specific actions are listed here.
  const actions: SuiteAction[] = [
    { key: "settings", label: "Settings", icon: SettingsIcon, to: "/settings" },
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
    </>
  );
}
