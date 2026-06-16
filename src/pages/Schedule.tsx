import { useEffect, useState } from "react";
import { CalendarDays, Plus, Trash2, Pill, Utensils, Activity, Stethoscope, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FeatureGuard } from "@/components/feature/FeatureGuard";
import { isTauri } from "@/lib/environment";
import { minutesToHHMM, hhmmToMinutes } from "@/lib/utils";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { listBlocks, createBlock, deleteBlock, type ScheduleBlock, type ScheduleKind } from "@/db/schedule";
import { ExcelButtons } from "@/components/feature/ExcelButtons";
import { FEATURE_EXCEL } from "@/lib/featureExcel";

const KIND_ICON: Record<ScheduleKind, typeof Pill> = {
  medication: Pill,
  meal: Utensils,
  activity: Activity,
  appointment: Stethoscope,
  other: Circle,
};
const KINDS: ScheduleKind[] = ["medication", "meal", "activity", "appointment", "other"];
const DAYS_LABEL: Record<string, string> = { daily: "Every day", weekdays: "Weekdays" };

export default function Schedule() {
  return (
    <FeatureGuard gateKey="schedule">
      <ScheduleInner />
    </FeatureGuard>
  );
}

function ScheduleInner() {
  const { profile } = useActiveProfile();
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [show, setShow] = useState(false);

  async function load() {
    if (!profile || !isTauri()) return;
    setBlocks(await listBlocks(profile.id));
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function onCreate(b: BlockForm) {
    if (!profile) return;
    await createBlock({
      profile_id: profile.id,
      kind: b.kind,
      title: b.title,
      start_min: hhmmToMinutes(b.start),
      end_min: b.end ? hhmmToMinutes(b.end) : null,
      days: b.days,
    });
    setShow(false);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarDays className="h-6 w-6 text-primary" /> Schedule
          </h1>
          <p className="text-muted-foreground">
            {profile ? `A typical day for ${profile.name}.` : "Create a profile first."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelButtons spec={FEATURE_EXCEL.schedule!} onImported={load} />
          <Button onClick={() => setShow((s) => !s)}>
            <Plus className="h-4 w-4" /> Add block
          </Button>
        </div>
      </div>

      {show && <BlockFormCard onSubmit={onCreate} onCancel={() => setShow(false)} />}

      {blocks.length === 0 && !show && (
        <p className="text-sm text-muted-foreground">
          Lay out medication times, meals, activity and appointments — they become reminders.
        </p>
      )}

      <div className="grid gap-2">
        {blocks.map((b) => {
          const Icon = KIND_ICON[b.kind];
          return (
            <Card key={b.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="w-14 shrink-0 text-sm font-medium tabular-nums">
                  {minutesToHHMM(b.start_min)}
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                  <Icon className="h-4 w-4 text-accent-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{b.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.end_min != null ? `until ${minutesToHHMM(b.end_min)} · ` : ""}
                    {DAYS_LABEL[b.days] ?? b.days}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteBlock(b.id).then(load)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface BlockForm {
  kind: ScheduleKind;
  title: string;
  start: string;
  end: string;
  days: string;
}

function BlockFormCard({ onSubmit, onCancel }: { onSubmit: (b: BlockForm) => void; onCancel: () => void }) {
  const [f, setF] = useState<BlockForm>({ kind: "activity", title: "", start: "08:00", end: "", days: "daily" });
  const set = <K extends keyof BlockForm>(k: K, v: BlockForm[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>New schedule block</CardTitle>
        <CardDescription>When something should happen in a typical day or week.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="btitle">What</Label>
          <Input id="btitle" placeholder="Morning medication" value={f.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bkind">Type</Label>
            <select id="bkind" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={f.kind} onChange={(e) => set("kind", e.target.value as ScheduleKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k[0]!.toUpperCase() + k.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bdays">Days</Label>
            <select id="bdays" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={f.days} onChange={(e) => set("days", e.target.value)}>
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bstart">Start</Label>
            <Input id="bstart" type="time" value={f.start} onChange={(e) => set("start", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bend">End (optional)</Label>
            <Input id="bend" type="time" value={f.end} onChange={(e) => set("end", e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => f.title.trim() && onSubmit(f)} disabled={!f.title.trim()}>
            Save
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
