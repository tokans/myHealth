import { useState } from "react";
import { HeartPulse, Bug } from "lucide-react";
import { SuiteShell, type SuiteNavItem, type SuiteAction } from "sharedcorelib/ui";
import { cn } from "@/lib/utils";
import { NAV, type NavItem } from "@/lib/nav";
import { GATES } from "@/lib/featureGate";
import { openExternal } from "@/lib/openExternal";
import { ReportIssueDialog } from "@/components/feedback/ReportIssueDialog";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { useGatingStore } from "@/stores/gating.store";
import { useTierStore, selectTier } from "@/stores/tier.store";

/** Visibility decision for a nav item given the live gating flags. */
function navState(item: NavItem, flags: ReturnType<typeof useGatingStore.getState>) {
  if (!item.gate) return "open" as const;
  const gate = GATES[item.gate];
  if (gate.isUnlocked(flags)) return "open" as const;
  return gate.lockBehavior === "nudge" ? ("nudge" as const) : ("hidden" as const);
}

/** The engagement-tier badge, shown in the desktop sidebar top and the mobile More header. */
function TierBadge() {
  const tier = useTierStore(selectTier);
  const Icon = tier.icon;
  return (
    <div className="flex items-center gap-2 rounded-md bg-accent/40 px-3 py-2 text-sm">
      <Icon className={cn("h-4 w-4", tier.className)} />
      <span className="font-medium">{tier.label}</span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const flags = useGatingStore();
  const [reportOpen, setReportOpen] = useState(false);

  // Visible nav (drop "hidden"-gated items), with the precomputed open/nudge state the shell needs.
  const nav: SuiteNavItem[] = NAV.map((it) => ({ it, state: navState(it, flags) }))
    .filter(({ state }) => state !== "hidden")
    .map(({ it, state }) => ({
      to: it.to,
      label: it.label,
      icon: it.icon,
      home: it.to === "/",
      end: it.to === "/",
      state: state as "open" | "nudge",
      lockHint: state === "nudge" ? GATES[it.gate!].unlockHint : undefined,
    }));

  // Mobile center button = the non-home primary destinations (here: Vitals). One action → a plain
  // center button; the shell auto-upgrades to a FAB + bottom sheet if more are added later.
  const centralActions: SuiteAction[] = NAV.filter(
    (it) => it.primary && it.to !== "/" && navState(it, flags) === "open",
  ).map((it) => ({ key: it.to, label: it.label, icon: it.icon, to: it.to }));

  // Suite-standard secondary actions (More drawer + desktop sidebar footer).
  const actions: SuiteAction[] = [
    { key: "report", label: "Report an issue", icon: Bug, onSelect: () => setReportOpen(true) },
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
        actions={actions}
        sidebarTop={<div className="px-3 pt-1"><TierBadge /></div>}
        moreHeader={<TierBadge />}
        profile={<ProfileMenu onReport={() => setReportOpen(true)} />}
        onExternal={(href) => void openExternal(href)}
        contentClassName="mx-auto max-w-3xl"
      >
        {children}
      </SuiteShell>
      <ReportIssueDialog open={reportOpen} onOpenChange={setReportOpen} />
    </>
  );
}
