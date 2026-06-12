import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { memberClassOf } from "sharedcorelib/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GATES, type GateKey } from "@/lib/featureGate";
import { GATE_CATEGORIES, memberPolicy } from "@/lib/memberPolicy";
import { useGatingStore } from "@/stores/gating.store";
import { useProfileStore, selectActiveProfile } from "@/stores/profile.store";

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

/**
 * Render children when the gate is open; otherwise the locked CTA.
 *
 * ADDITIVE (K4) person-linked soft gate (decision 19, UI-soft): before the tier/reveal
 * `isUnlocked` check, the ACTIVE profile's spine `member_class` is consulted against
 * myHealth's child-soft policy. A sensitive-category gate (document vault / import,
 * tagged `estate`) denied to a `child_user` renders the locked card. For the free
 * single-user install — and for any profile with no member_class — `memberClassOf`
 * resolves to `owner`, which is allowed everything, so behaviour is pixel-identical to
 * pre-K4 (invariant 3). Medical features carry no category tag and stay visible to every
 * member under the family-profile model (decision 18).
 */
export function FeatureGuard({ gateKey, children }: { gateKey: GateKey; children: React.ReactNode }) {
  const flags = useGatingStore();
  const activeProfile = useProfileStore(selectActiveProfile);
  const memberClass = memberClassOf({ member_class: activeProfile?.member_class });
  const categories = GATE_CATEGORIES[gateKey];
  const memberAllowed = memberPolicy.isFeatureAllowed(memberClass, gateKey, categories);
  const open = memberAllowed && GATES[gateKey].isUnlocked(flags);
  return open ? <>{children}</> : <LockedFeature gateKey={gateKey} />;
}
