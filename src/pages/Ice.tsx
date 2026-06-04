import { useEffect, useState } from "react";
import { HeartPulse, Printer, Plus, X, Phone, Mail, Pencil, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FeatureGuard } from "@/components/feature/FeatureGuard";
import { isTauri } from "@/lib/environment";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { getProfile, updateEmergency, type Profile, type EmergencyInfo } from "@/db/profiles";
import { listBaseline, addBaseline, deleteBaseline, type BaselineItem } from "@/db/baseline";
import { listMedications, type Medication } from "@/db/medications";
import { telHref, mailtoHref, ageFromDob, EMERGENCY_DISCLAIMER } from "@/lib/emergency";
import { exportVisitReport } from "@/lib/visitReport";
import { cn } from "@/lib/utils";

export default function Ice() {
  return (
    <FeatureGuard gateKey="ice">
      <IceInner />
    </FeatureGuard>
  );
}

function IceInner() {
  const { profile: initial } = useActiveProfile();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allergies, setAllergies] = useState<BaselineItem[]>([]);
  const [conditions, setConditions] = useState<BaselineItem[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [editing, setEditing] = useState(false);

  async function load(id: number) {
    setProfile(await getProfile(id));
    setAllergies(await listBaseline(id, "allergy"));
    setConditions(await listBaseline(id, "condition"));
    setMeds(await listMedications(id));
  }
  useEffect(() => {
    if (initial && isTauri()) void load(initial.id);
  }, [initial]);

  if (!isTauri()) return <p className="text-sm text-muted-foreground">The medical card is available in the desktop app.</p>;
  if (!profile) return <p className="text-muted-foreground">Create a profile to build a medical card.</p>;

  const pid = profile.id;
  const age = ageFromDob(profile.dob);
  const phone = profile.emergency_phone ?? "";
  const email = profile.emergency_email ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <HeartPulse className="h-6 w-6 text-primary" /> Medical card
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing((e) => !e)}>
            <Pencil className="h-4 w-4" /> {editing ? "Done" : "Edit"}
          </Button>
          <Button variant="secondary" onClick={() => void exportVisitReport(pid)}>
            <FileText className="h-4 w-4" /> Visit summary
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* The card */}
      <Card className="border-2">
        <CardHeader className="bg-accent/40">
          <CardTitle className="flex items-center justify-between">
            <span>
              {profile.name}
              {age != null ? `, ${age}` : ""}
            </span>
            {profile.blood_group && (
              <span className="rounded bg-destructive px-2 py-0.5 text-sm font-bold text-destructive-foreground">
                {profile.blood_group}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Section title="Allergies">
            {allergies.length === 0 ? (
              <Empty>None recorded</Empty>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allergies.map((a) => (
                  <Chip key={a.id} danger={a.severity === "severe"} onRemove={editing ? () => deleteBaseline(a.id).then(() => load(pid)) : undefined}>
                    {a.label}
                    {a.severity === "severe" ? " (severe)" : ""}
                  </Chip>
                ))}
              </div>
            )}
            {editing && <QuickAdd onAdd={(label) => addBaseline({ profile_id: pid, kind: "allergy", label, severity: "severe" }).then(() => load(pid))} placeholder="Add allergy (recorded as severe)" />}
          </Section>

          <Section title="Conditions">
            {conditions.length === 0 ? (
              <Empty>None recorded</Empty>
            ) : (
              <div className="flex flex-wrap gap-2">
                {conditions.map((c) => (
                  <Chip key={c.id} onRemove={editing ? () => deleteBaseline(c.id).then(() => load(pid)) : undefined}>
                    {c.label}
                  </Chip>
                ))}
              </div>
            )}
            {editing && <QuickAdd onAdd={(label) => addBaseline({ profile_id: pid, kind: "condition", label }).then(() => load(pid))} placeholder="Add condition" />}
          </Section>

          <Section title="Current medications">
            {meds.length === 0 ? (
              <Empty>None recorded</Empty>
            ) : (
              <ul className="text-sm">
                {meds.map((m) => (
                  <li key={m.id}>
                    • {m.drug}
                    {m.strength ? ` ${m.strength}` : ""}
                    {m.schedule ? ` — ${m.schedule}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="In an emergency, contact">
            {profile.emergency_contact || profile.emergency_phone ? (
              <div className="space-y-1 text-sm">
                <div className="font-medium">{profile.emergency_contact}</div>
                <div className="flex flex-wrap gap-3">
                  {phone && (
                    <a className="flex items-center gap-1 text-primary hover:underline" href={telHref(phone) ?? undefined}>
                      <Phone className="h-3.5 w-3.5" /> {phone}
                    </a>
                  )}
                  {email && (
                    <a className="flex items-center gap-1 text-primary hover:underline" href={mailtoHref(email) ?? undefined}>
                      <Mail className="h-3.5 w-3.5" /> {email}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <Empty>No emergency contact set</Empty>
            )}
          </Section>

          {(profile.organ_donor === 1 || profile.advance_directive) && (
            <Section title="Notes">
              {profile.organ_donor === 1 && <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Registered organ donor</div>}
              {profile.advance_directive && <div className="text-sm">{profile.advance_directive}</div>}
            </Section>
          )}
        </CardContent>
      </Card>

      {editing && <EmergencyEditor profile={profile} onSaved={() => load(pid)} />}

      <p className="text-xs text-muted-foreground">{EMERGENCY_DISCLAIMER}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground">{children}</div>;
}
function Chip({ children, danger, onRemove }: { children: React.ReactNode; danger?: boolean; onRemove?: () => void }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm", danger ? "bg-destructive/15 text-destructive" : "bg-secondary")}>
      {children}
      {onRemove && (
        <button onClick={onRemove} className="opacity-60 hover:opacity-100">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
function QuickAdd({ onAdd, placeholder }: { onAdd: (label: string) => void; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2 pt-1">
      <Input value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) { onAdd(v.trim()); setV(""); } }} />
      <Button size="sm" variant="secondary" onClick={() => { if (v.trim()) { onAdd(v.trim()); setV(""); } }}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EmergencyEditor({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [e, setE] = useState<EmergencyInfo>({
    emergency_contact: profile.emergency_contact,
    emergency_phone: profile.emergency_phone,
    emergency_email: profile.emergency_email,
    organ_donor: profile.organ_donor,
    advance_directive: profile.advance_directive,
  });
  const set = <K extends keyof EmergencyInfo>(k: K, v: EmergencyInfo[K]) => setE((p) => ({ ...p, [k]: v }));

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle>Emergency contact & notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Contact name</Label>
            <Input value={e.emergency_contact ?? ""} onChange={(ev) => set("emergency_contact", ev.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={e.emergency_phone ?? ""} onChange={(ev) => set("emergency_phone", ev.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={e.emergency_email ?? ""} onChange={(ev) => set("emergency_email", ev.target.value)} />
          </div>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={e.organ_donor === 1} onChange={(ev) => set("organ_donor", ev.target.checked ? 1 : 0)} />
            Registered organ donor
          </label>
        </div>
        <div className="space-y-1.5">
          <Label>Advance directive note</Label>
          <Input value={e.advance_directive ?? ""} onChange={(ev) => set("advance_directive", ev.target.value)} />
        </div>
        <Button onClick={() => updateEmergency(profile.id, e).then(onSaved)}>Save</Button>
      </CardContent>
    </Card>
  );
}
