import { useTierStore, selectTier, selectNextTier } from "@/stores/tier.store";
import { cn } from "@/lib/utils";

/** A subtle, motivating strip: current tier + the single next milestone. Never nags. */
export function JourneyStrip() {
  const tier = useTierStore(selectTier);
  const next = useTierStore(selectNextTier);
  const Icon = tier.icon;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-accent/40 px-4 py-3 text-sm">
      <Icon className={cn("h-5 w-5 shrink-0", tier.className)} />
      <div className="min-w-0">
        <div className="font-medium">You're a {tier.label}</div>
        {next ? (
          <div className="truncate text-muted-foreground">Next: {next.label} — {next.criteria}</div>
        ) : (
          <div className="text-muted-foreground">You've unlocked everything. 🎉</div>
        )}
      </div>
    </div>
  );
}
