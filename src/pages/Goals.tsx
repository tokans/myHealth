import { useEffect, useState } from "react";
import { Target, Plus, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FeatureGuard } from "@/components/feature/FeatureGuard";
import { isTauri } from "@/lib/environment";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { listGoals, createGoal, archiveGoal, type Goal } from "@/db/goals";
import { listMetrics } from "@/db/metrics";
import { projectGoal, type GoalDirection, type GoalProjection } from "@/domain/goals";
import { METRIC_KINDS, metricKind } from "@/lib/metricKinds";
import { useTierStore } from "@/stores/tier.store";
import { useGatingStore } from "@/stores/gating.store";
import { cn } from "@/lib/utils";

export default function Goals() {
  return (
    <FeatureGuard gateKey="goals">
      <GoalsInner />
    </FeatureGuard>
  );
}

function GoalsInner() {
  const { profile } = useActiveProfile();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [proj, setProj] = useState<Record<number, GoalProjection>>({});
  const [show, setShow] = useState(false);
  const refreshTier = useTierStore((s) => s.refresh);
  const refreshGating = useGatingStore((s) => s.refresh);

  async function load() {
    if (!profile || !isTauri()) return;
    const gs = await listGoals(profile.id);
    setGoals(gs);
    const entries = await Promise.all(
      gs.map(async (g) => {
        if (!g.metric_kind || g.target == null) return [g.id, null] as const;
        const points = (await listMetrics(profile.id, g.metric_kind)).map((m) => ({
          date: m.taken_at.slice(0, 10),
          value: m.value,
        }));
        return [
          g.id,
          projectGoal(points, {
            baseline: g.baseline,
            target: g.target,
            direction: g.direction,
            targetDate: g.target_date,
          }),
        ] as const;
      }),
    );
    setProj(Object.fromEntries(entries.filter(([, p]) => p) as [number, GoalProjection][]));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function onCreate(f: GoalForm) {
    if (!profile) return;
    const mk = f.metricKind ? metricKind(f.metricKind) : undefined;
    await createGoal({
      profile_id: profile.id,
      kind: f.metricKind ? "metric" : "habit",
      title: f.title,
      metric_kind: f.metricKind || null,
      baseline: f.baseline ? Number(f.baseline) : null,
      target: f.target ? Number(f.target) : null,
      unit: mk?.unit ?? null,
      direction: f.direction,
      target_date: f.targetDate || null,
    });
    setShow(false);
    await load();
    await Promise.all([refreshTier(), refreshGating()]);
  }

  async function onArchive(id: number) {
    await archiveGoal(id);
    await load();
    await Promise.all([refreshTier(), refreshGating()]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Target className="h-6 w-6 text-primary" /> Goals
        </h1>
        <Button onClick={() => setShow((s) => !s)}>
          <Plus className="h-4 w-4" /> New goal
        </Button>
      </div>

      {show && <GoalFormCard onSubmit={onCreate} onCancel={() => setShow(false)} />}

      {goals.length === 0 && !show && (
        <p className="text-sm text-muted-foreground">
          No goals yet. Set one — e.g. reach 72&nbsp;kg, or 8,000 steps a day.
        </p>
      )}

      <div className="grid gap-3">
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} projection={proj[g.id]} onArchive={() => onArchive(g.id)} />
        ))}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  achieved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  on_track: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  behind: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  no_data: "bg-secondary text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = {
  achieved: "Achieved 🎉",
  on_track: "On track",
  behind: "Behind",
  no_data: "Log data",
};

function GoalCard({
  goal,
  projection,
  onArchive,
}: {
  goal: Goal;
  projection?: GoalProjection;
  onArchive: () => void;
}) {
  const p = projection;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-medium">{goal.title}</div>
            <div className="text-sm text-muted-foreground">
              {goal.target != null ? `Target ${goal.target}${goal.unit ?? ""}` : "Habit goal"}
              {goal.target_date ? ` by ${goal.target_date}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {p && (
              <span className={cn("rounded px-2 py-0.5 text-xs font-medium", STATUS_STYLE[p.status])}>
                {STATUS_LABEL[p.status]}
              </span>
            )}
            <Button size="icon" variant="ghost" onClick={onArchive} title="Archive">
              <Archive className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {p && goal.target != null && (
          <>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${p.progressPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{p.current != null ? `Now ${p.current}${goal.unit ?? ""}` : "No readings yet"}</span>
              <span>
                {p.status === "achieved"
                  ? "Done"
                  : p.etaDate
                    ? `ETA ${p.etaDate}`
                    : p.status === "behind"
                      ? "Trending away"
                      : "Keep logging"}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface GoalForm {
  title: string;
  metricKind: string;
  target: string;
  baseline: string;
  direction: GoalDirection;
  targetDate: string;
}

function GoalFormCard({ onSubmit, onCancel }: { onSubmit: (f: GoalForm) => void; onCancel: () => void }) {
  const [f, setF] = useState<GoalForm>({
    title: "",
    metricKind: "weight",
    target: "",
    baseline: "",
    direction: "decrease",
    targetDate: "",
  });
  const set = <K extends keyof GoalForm>(k: K, v: GoalForm[K]) => setF((p) => ({ ...p, [k]: v }));

  function pickMetric(kind: string) {
    const mk = kind ? metricKind(kind) : undefined;
    setF((p) => ({ ...p, metricKind: kind, direction: mk?.direction ?? p.direction }));
  }

  const unit = f.metricKind ? (metricKind(f.metricKind)?.unit ?? "") : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>New goal</CardTitle>
        <CardDescription>
          Measurable goals project an ETA from your logged readings. Deterministic, advisory — not
          medical advice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="gtitle">Title</Label>
          <Input id="gtitle" placeholder="Reach a healthy weight" value={f.title} onChange={(e) => set("title", e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gmetric">Track which metric?</Label>
          <select
            id="gmetric"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={f.metricKind}
            onChange={(e) => pickMetric(e.target.value)}
          >
            <option value="">None (habit goal)</option>
            {METRIC_KINDS.map((m) => (
              <option key={m.kind} value={m.kind}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {f.metricKind && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gbaseline">Baseline ({unit})</Label>
              <Input id="gbaseline" type="number" value={f.baseline} onChange={(e) => set("baseline", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gtarget">Target ({unit})</Label>
              <Input id="gtarget" type="number" value={f.target} onChange={(e) => set("target", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gdir">Direction</Label>
              <select
                id="gdir"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={f.direction}
                onChange={(e) => set("direction", e.target.value as GoalDirection)}
              >
                <option value="decrease">Lower is better</option>
                <option value="increase">Higher is better</option>
                <option value="maintain">Maintain</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gdate">Target date</Label>
              <Input id="gdate" type="date" value={f.targetDate} onChange={(e) => set("targetDate", e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => f.title.trim() && onSubmit(f)}
            disabled={!f.title.trim() || (!!f.metricKind && !f.target.trim())}
          >
            Save goal
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
