import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isTauri } from "@/lib/environment";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { addMetric, listMetrics, type Metric } from "@/db/metrics";
import { localToday } from "@/lib/utils";
import { useTierStore } from "@/stores/tier.store";
import { useGatingStore } from "@/stores/gating.store";

const METRIC_KINDS: { kind: string; label: string; unit: string }[] = [
  { kind: "weight", label: "Weight", unit: "kg" },
  { kind: "bp_systolic", label: "Blood pressure (systolic)", unit: "mmHg" },
  { kind: "bp_diastolic", label: "Blood pressure (diastolic)", unit: "mmHg" },
  { kind: "glucose_fasting", label: "Fasting glucose", unit: "mg/dL" },
  { kind: "heart_rate", label: "Resting heart rate", unit: "bpm" },
  { kind: "spo2", label: "SpO₂", unit: "%" },
  { kind: "temperature", label: "Temperature", unit: "°C" },
];

export default function Metrics() {
  const { profile } = useActiveProfile();
  const [kind, setKind] = useState(METRIC_KINDS[0]!.kind);
  const [value, setValue] = useState("");
  const [date, setDate] = useState(localToday());
  const [recent, setRecent] = useState<Metric[]>([]);
  const refreshTier = useTierStore((s) => s.refresh);
  const refreshGating = useGatingStore((s) => s.refresh);

  const meta = METRIC_KINDS.find((m) => m.kind === kind)!;

  async function loadRecent() {
    if (!profile || !isTauri()) return;
    setRecent((await listMetrics(profile.id, kind)).slice(-8).reverse());
  }
  useEffect(() => {
    void loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, kind]);

  async function onAdd() {
    if (!profile || !value.trim()) return;
    await addMetric({
      profile_id: profile.id,
      kind,
      value: Number(value),
      unit: meta.unit,
      taken_at: date,
    });
    setValue("");
    await loadRecent();
    await Promise.all([refreshTier(), refreshGating()]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Activity className="h-6 w-6 text-primary" /> Vitals
        </h1>
        <p className="text-muted-foreground">
          {profile ? `Logging for ${profile.name}.` : "Create a profile first."}
        </p>
      </div>

      {profile && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Log a reading</CardTitle>
            <CardDescription>Quick, one-tap entry. Stored on this device only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="kind">What</Label>
              <select
                id="kind"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {METRIC_KINDS.map((m) => (
                  <option key={m.kind} value={m.kind}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="val">Value ({meta.unit})</Label>
                <Input
                  id="val"
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onAdd()}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <Button onClick={onAdd} disabled={!value.trim()}>
              Save reading
            </Button>
          </CardContent>
        </Card>
      )}

      {recent.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Recent {meta.label.toLowerCase()}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {recent.map((m) => (
                <li key={m.id} className="flex justify-between py-2">
                  <span className="text-muted-foreground">{m.taken_at.slice(0, 10)}</span>
                  <span className="font-medium">
                    {m.value} {m.unit}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
