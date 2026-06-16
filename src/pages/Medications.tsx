import { useEffect, useState } from "react";
import { Pill, Plus, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FeatureGuard } from "@/components/feature/FeatureGuard";
import { isTauri } from "@/lib/environment";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { listMedications, createMedication, archiveMedication, type Medication } from "@/db/medications";
import { ExcelButtons } from "@/components/feature/ExcelButtons";
import { FEATURE_EXCEL } from "@/lib/featureExcel";
import { useTierStore } from "@/stores/tier.store";
import { useGatingStore } from "@/stores/gating.store";

const SCHEDULES = [
  { value: "OD", label: "Once a day (OD)" },
  { value: "BD", label: "Twice a day (BD)" },
  { value: "TDS", label: "Three times a day (TDS)" },
  { value: "QID", label: "Four times a day (QID)" },
  { value: "PRN", label: "As needed (PRN)" },
];

export default function Medications() {
  return (
    <FeatureGuard gateKey="medications">
      <MedicationsInner />
    </FeatureGuard>
  );
}

function MedicationsInner() {
  const { profile } = useActiveProfile();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [show, setShow] = useState(false);
  const refreshTier = useTierStore((s) => s.refresh);
  const refreshGating = useGatingStore((s) => s.refresh);

  async function load() {
    if (!profile || !isTauri()) return;
    setMeds(await listMedications(profile.id));
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function onCreate(f: MedForm) {
    if (!profile) return;
    await createMedication({
      profile_id: profile.id,
      drug: f.drug,
      strength: f.strength || undefined,
      form: f.form || undefined,
      schedule: f.schedule,
      prescriber: f.prescriber || undefined,
      notes: f.notes || undefined,
    });
    setShow(false);
    await load();
    await Promise.all([refreshTier(), refreshGating()]);
  }
  async function onArchive(id: number) {
    await archiveMedication(id);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Pill className="h-6 w-6 text-primary" /> Medications
          </h1>
          <p className="text-muted-foreground">
            {profile ? `Current medications for ${profile.name}.` : "Create a profile first."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelButtons spec={FEATURE_EXCEL.medications!} onImported={load} />
          <Button onClick={() => setShow((s) => !s)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {show && <MedFormCard onSubmit={onCreate} onCancel={() => setShow(false)} />}

      {meds.length === 0 && !show && (
        <p className="text-sm text-muted-foreground">
          No medications yet. Add one — scheduled meds become a daily reminder.
        </p>
      )}

      <div className="grid gap-2">
        {meds.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">
                  {m.drug} {m.strength && <span className="text-muted-foreground">· {m.strength}</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {[m.form, m.schedule, m.prescriber].filter(Boolean).join(" · ")}
                </div>
              </div>
              <Button size="icon" variant="ghost" title="Stop / archive" onClick={() => onArchive(m.id)}>
                <Archive className="h-4 w-4 text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        myHealth records your medications and reminds you — it never advises on doses or checks
        interactions. Always follow your doctor and pharmacist.
      </p>
    </div>
  );
}

interface MedForm {
  drug: string;
  strength: string;
  form: string;
  schedule: string;
  prescriber: string;
  notes: string;
}

function MedFormCard({ onSubmit, onCancel }: { onSubmit: (f: MedForm) => void; onCancel: () => void }) {
  const [f, setF] = useState<MedForm>({ drug: "", strength: "", form: "tablet", schedule: "OD", prescriber: "", notes: "" });
  const set = <K extends keyof MedForm>(k: K, v: MedForm[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a medication</CardTitle>
        <CardDescription>Just the drug name is required.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="drug">Drug</Label>
            <Input id="drug" value={f.drug} onChange={(e) => set("drug", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="strength">Strength</Label>
            <Input id="strength" placeholder="500 mg" value={f.strength} onChange={(e) => set("strength", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="form">Form</Label>
            <Input id="form" placeholder="tablet" value={f.form} onChange={(e) => set("form", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sched">Schedule</Label>
            <select id="sched" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={f.schedule} onChange={(e) => set("schedule", e.target.value)}>
              {SCHEDULES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="presc">Prescriber (optional)</Label>
          <Input id="presc" value={f.prescriber} onChange={(e) => set("prescriber", e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => f.drug.trim() && onSubmit(f)} disabled={!f.drug.trim()}>
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
