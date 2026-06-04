import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FeatureGuard } from "@/components/feature/FeatureGuard";
import type { GateKey } from "@/lib/featureGate";

/**
 * Generic page for features that are gated and not yet implemented in this build.
 * The FeatureGuard renders the locked CTA when the gate is closed; once unlocked,
 * a "coming soon" card stands in until the real page lands (per the roadmap).
 */
export function Placeholder({
  gateKey,
  title,
  description,
}: {
  gateKey: GateKey;
  title: string;
  description: string;
}) {
  return (
    <FeatureGuard gateKey={gateKey}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <Card>
          <CardHeader>
            <CardTitle>Unlocked 🎉</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This feature is on the roadmap and arrives in a later build.
          </CardContent>
        </Card>
      </div>
    </FeatureGuard>
  );
}
