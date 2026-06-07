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
import { iceStore } from "@/db/sharedDb";
import { iceCardPersonKey, type IceCard } from "sharedcorelib/ice";
import { cn } from "@/lib/utils";

/**
 * Build the denormalized snapshot pushed to the shared common ICE card. myHealth is
 * authoritative for the medical fields; for the contact fields we keep whatever the
 * shared card already has (e.g. an edit made in myFinance) unless this profile sets them,
 * so a medical-only refresh never clobbers the other app's contact edits.
 */
function buildIceSnapshot(
  personKey: string,
  profile: Profile,
  allergies: BaselineItem[],
  conditions: BaselineItem[],
  meds: Medication[],
  existing: IceCard | null,
): IceCard {
  const medLine = (m: Medication) =>
    `${m.drug}${m.strength ? ` ${m.strength}` : ""}${m.schedule ? ` — ${m.schedule}` : ""}`;
  return {
    person_key: personKey,
    display_name: profile.name,
    blood_group: profile.blood_group ?? existing?.blood_group ?? null,
    contact_name: profile.emergency_contact ?? existing?.contact_name ?? null,
    contact_phone: profile.emergency_phone ?? existing?.contact_phone ?? null,
    contact_email: profile.emergency_email ?? existing?.contact_email ?? null,
    allergies: allergies.map((a) => (a.severity === "severe" ? `${a.label} (severe)` : a.label)).join(", ") || null,
    conditions: conditions.map((c) => c.label).join(", ") || null,
    medications: meds.map(medLine).join("; ") || null,
    organ_donor: profile.organ_donor,
    advance_directive: profile.advance_directive ?? existing?.advance_directive ?? null,
    notes: existing?.notes ?? null,
    updated_at: new Date().toISOString(),
    source_app: "myHealth",
  };
}

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
  const [shared, setShared] = useState<IceCard | null>(null);
  const [editing, setEditing] = useState(false);

  async function load(id: number) {
    const [p, a, c, m] = await Promise.all([
      getProfile(id),
      listBaseline(id, "allergy"),
      listBaseline(id, "condition"),
      listMedications(id),
    ]);
    setProfile(p);
    setAllergies(a);
    setConditions(c);
    setMeds(m);

    // Mirror this profile's card into the shared common ICE table so it's available to
    // the rest of the suite (e.g. myFinance), and pull back any cross-app edits to show.
    if (p) {
      try {
        const store = await iceStore();
        if (store) {
          const key = iceCardPersonKey({ isSelf: p.is_self === 1, name: p.name });
          const existing = await store.get(key);
          await store.upsert(buildIceSnapshot(key, p, a, c, m, existing));
          setShared(await store.get(key));
        }
      } catch (e) {
        console.warn("shared ICE sync skipped:", e);
      }
    }
  }
  useEffect(() => {
    if (initial && isTauri()) void load(initial.id);
  }, [initial]);

  if (!isTauri()) return <p className="text-sm text-muted-foreground">The medical card is available in the desktop app.</p>;
  if (!profile) return <p className="text-muted-foreground">Create a profile to build a medical card.</p>;

  const pid = profile.id;
  const age = ageFromDob(profile.dob);
  // Contact fields fall back to the shared common card so edits made in another suite
  // app (e.g. myFinance) appear here too.
  const contactName = profile.emergency_contact ?? shared?.contact_name ?? "";
  const phone = profile.emergency_phone ?? shared?.contact_phone ?? "";
  const email = profile.emergency_email ?? shared?.contact_email ?? "";

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
            {contactName || phone ? (
              <div className="space-y-1 text-sm">
                <div className="font-medium">{contactName}</div>
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

      {shared && (
        <p className="text-xs text-muted-foreground">
          This emergency card is shared across your Tokans suite apps, so contact details
          stay in sync.
        </p>
      )}
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
