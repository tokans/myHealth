import { Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FeatureGuard } from "@/components/feature/FeatureGuard";

export default function Goals() {
  return (
    <FeatureGuard gateKey="goals">
      <div className="space-y-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Target className="h-6 w-6 text-primary" /> Goals
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>Set a goal</CardTitle>
            <CardDescription>
              Pick a target (e.g. reach 70&nbsp;kg, walk 8,000 steps/day) and track progress with a
              deterministic projection. Goal creation arrives in the next build.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            You've unlocked goals by logging a metric — nice. 🎯
          </CardContent>
        </Card>
      </div>
    </FeatureGuard>
  );
}
