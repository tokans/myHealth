import { NavLink } from "react-router-dom";
import { Lock } from "lucide-react";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { GATES } from "@/lib/featureGate";
import type { NavItem } from "@/lib/nav";
import { useTierStore, selectTier } from "@/stores/tier.store";

export type NavEntry = { item: NavItem; state: "open" | "nudge" };

function TierRow() {
  const tier = useTierStore(selectTier);
  const Icon = tier.icon;
  return (
    <div className="flex items-center gap-2 rounded-md bg-accent/40 px-3 py-2 text-sm">
      <Icon className={cn("h-4 w-4", tier.className)} />
      <span className="font-medium">{tier.label}</span>
    </div>
  );
}

/** Mobile "More" drawer: every nav destination that isn't a primary bottom tab. */
export function MoreDrawer({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavEntry[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" title="More">
        <div className="flex-1 overflow-y-auto p-2">
          <div className="px-1 pb-2">
            <TierRow />
          </div>
          <nav className="flex flex-col gap-1">
            {items.map(({ item, state }) => {
              const Icon = item.icon;
              return (
                <SheetClose asChild key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                        isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                        state === "nudge" && "text-muted-foreground",
                      )
                    }
                    title={state === "nudge" ? GATES[item.gate!].unlockHint : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {state === "nudge" && <Lock className="h-3.5 w-3.5 opacity-70" />}
                  </NavLink>
                </SheetClose>
              );
            })}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
