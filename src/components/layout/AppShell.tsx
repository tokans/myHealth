import { NavLink } from "react-router-dom";
import { Lock, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV, type NavItem } from "@/lib/nav";
import { GATES } from "@/lib/featureGate";
import { useGatingStore } from "@/stores/gating.store";
import { useTierStore, selectTier } from "@/stores/tier.store";

/** Visibility decision for a nav item given the live gating flags. */
function navState(item: NavItem, flags: ReturnType<typeof useGatingStore.getState>) {
  if (!item.gate) return "open" as const;
  const gate = GATES[item.gate];
  if (gate.isUnlocked(flags)) return "open" as const;
  return gate.lockBehavior === "nudge" ? ("nudge" as const) : ("hidden" as const);
}

function TierBadge() {
  const tier = useTierStore(selectTier);
  const Icon = tier.icon;
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm">
      <Icon className={cn("h-4 w-4", tier.className)} />
      <span className="font-medium">{tier.label}</span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const flags = useGatingStore();
  const items = NAV.filter((it) => navState(it, flags) !== "hidden");
  const mobileItems = items.filter((it) => it.primary);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex items-center gap-2 px-4 py-4 text-lg font-semibold">
          <HeartPulse className="h-5 w-5 text-primary" />
          myHealth
        </div>
        <TierBadge />
        <nav className="mt-2 flex flex-col gap-1 px-2">
          {items.map((it) => {
            const state = navState(it, flags);
            const Icon = it.icon;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                    state === "nudge" && "text-muted-foreground",
                  )
                }
                title={state === "nudge" ? GATES[it.gate!].unlockHint : undefined}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{it.label}</span>
                {state === "nudge" && <Lock className="h-3.5 w-3.5 opacity-70" />}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
        <div className="flex items-center gap-2 font-semibold">
          <HeartPulse className="h-5 w-5 text-primary" />
          myHealth
        </div>
        <TierBadge />
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t bg-card py-1 md:hidden">
        {mobileItems.map((it) => {
          const Icon = it.icon;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px]",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <Icon className="h-5 w-5" />
              {it.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
