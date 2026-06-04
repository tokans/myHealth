import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GATES, type GateKey } from "@/lib/featureGate";
import { useGatingStore } from "@/stores/gating.store";

/** Locked-state card shown for a gated feature (both nudge and hidden routes). */
export function LockedFeature({ gateKey }: { gateKey: GateKey }) {
  const gate = GATES[gateKey];
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <CardHeader className="items-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent">
          <Lock className="h-5 w-5 text-accent-foreground" />
        </div>
        <CardTitle>{gate.lockedTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{gate.unlockHint}</p>
        {gate.ctaTo && (
          <Button asChild>
            <Link to={gate.ctaTo}>{gate.ctaLabel}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Render children when the gate is open; otherwise the locked CTA. */
export function FeatureGuard({ gateKey, children }: { gateKey: GateKey; children: React.ReactNode }) {
  const flags = useGatingStore();
  const open = GATES[gateKey].isUnlocked(flags);
  return open ? <>{children}</> : <LockedFeature gateKey={gateKey} />;
}
