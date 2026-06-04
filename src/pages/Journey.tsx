import { Check, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TIERS } from "@/lib/gamification";
import { useTierStore } from "@/stores/tier.store";
import { cn } from "@/lib/utils";

export default function Journey() {
  const ctx = useTierStore((s) => s.ctx);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your journey</h1>
        <p className="text-muted-foreground">
          Features unlock as you use myHealth. Everything below is computed on your device — nothing
          is ever sent anywhere.
        </p>
      </div>

      <div className="grid gap-3">
        {TIERS.map((tier) => {
          const reached = tier.reached(ctx);
          const Icon = tier.icon;
          return (
            <Card key={tier.key} className={cn(!reached && "opacity-70")}>
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                  <Icon className={cn("h-5 w-5", tier.className)} />
                </div>
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {tier.label}
                    {tier.grant && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                        granted
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{tier.criteria}</CardDescription>
                </div>
                {reached ? (
                  <Check className="h-5 w-5 text-primary" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
              </CardHeader>
              {!reached && !tier.grant && (
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {progressHint(tier.key, ctx)}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function progressHint(key: string, ctx: ReturnType<typeof useTierStore.getState>["ctx"]): string {
  switch (key) {
    case "tracker":
      return `Logged on ${ctx.activeLogDays} day(s) so far.`;
    case "caretaker":
      return `${ctx.profileCount} profile(s); active on ${ctx.distinctDays} day(s).`;
    case "champion":
      return `Active on ${ctx.distinctDays} day(s); ${ctx.goalCount} goal(s).`;
    default:
      return "";
  }
}
