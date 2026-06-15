import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, User, Trash2, Activity } from "lucide-react";
import { getCommonBaked } from "sharedcorelib/masters";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isTauri } from "@/lib/environment";
import { listProfiles, createProfile, deleteProfile, type Profile } from "@/db/profiles";
import { useTierStore } from "@/stores/tier.store";
import { useGatingStore } from "@/stores/gating.store";
import { useProfileStore } from "@/stores/profile.store";

const RELATIONSHIPS = getCommonBaked("relationship"); // common master, reused (no recreate)

export default function Profiles() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [show, setShow] = useState(false);
  const refreshTier = useTierStore((s) => s.refresh);
  const refreshGating = useGatingStore((s) => s.refresh);
  const refreshProfiles = useProfileStore((s) => s.refresh);
  const setActiveProfile = useProfileStore((s) => s.setActive);

  /** Make this person the active profile and jump to their Vitals (per-person logging). */
  function openVitals(id: number) {
    setActiveProfile(id);
    navigate("/metrics");
  }

  async function load() {
    if (!isTauri()) return;
    setProfiles(await listProfiles());
    await refreshProfiles(); // keep the shared store (top-bar drawer) in sync
  }
  useEffect(() => {
    void load();
  }, []);

  const hasSelf = profiles.some((p) => p.is_self);

  async function onCreate(form: NewProfileForm) {
    const id = await createProfile({
      name: form.name,
      is_self: form.isSelf ? 1 : 0,
      relationship: form.isSelf ? null : form.relationship || null,
      sex: form.sex,
      dob: form.dob || undefined,
      blood_group: form.bloodGroup || undefined,
      height_cm: form.heightCm ? Number(form.heightCm) : undefined,
    });
    // The new person becomes active so logging their first vitals is one tap away.
    if (id) setActiveProfile(id);
    setShow(false);
    await load();
    await Promise.all([refreshTier(), refreshGating()]);
  }

  async function onDelete(id: number) {
    await deleteProfile(id);
    await load();
    await Promise.all([refreshTier(), refreshGating()]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Profiles</h1>
          <p className="text-muted-foreground">You and your family. Everything is scoped per person.</p>
        </div>
        <Button onClick={() => setShow((s) => !s)}>
          <UserPlus className="h-4 w-4" /> Add
        </Button>
      </div>

      {show && <ProfileForm hasSelf={hasSelf} onSubmit={onCreate} onCancel={() => setShow(false)} />}

      {!isTauri() && (
        <p className="text-sm text-muted-foreground">Profiles are available in the desktop app.</p>
      )}

      <div className="grid gap-3">
        {profiles.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                  <User className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.is_self ? "You" : p.relationship || "Family member"}
                    {p.blood_group ? ` · ${p.blood_group}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => openVitals(p.id)}>
                  <Activity className="h-4 w-4" /> Vitals
                </Button>
                {!p.is_self && (
                  <Button size="icon" variant="ghost" onClick={() => onDelete(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface NewProfileForm {
  name: string;
  isSelf: boolean;
  relationship: string;
  sex: Profile["sex"];
  dob: string;
  bloodGroup: string;
  heightCm: string;
}

function ProfileForm({
  hasSelf,
  onSubmit,
  onCancel,
}: {
  hasSelf: boolean;
  onSubmit: (f: NewProfileForm) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<NewProfileForm>({
    name: "",
    isSelf: !hasSelf,
    relationship: "",
    sex: "unspecified",
    dob: "",
    bloodGroup: "",
    heightCm: "",
  });
  const set = <K extends keyof NewProfileForm>(k: K, v: NewProfileForm[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{f.isSelf ? "Your profile" : "New family member"}</CardTitle>
        <CardDescription>Only a name is required — fill in the rest anytime.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </div>

        {!hasSelf && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isSelf} onChange={(e) => set("isSelf", e.target.checked)} />
            This is me
          </label>
        )}

        {!f.isSelf && (
          <div className="space-y-1.5">
            <Label htmlFor="rel">Relationship</Label>
            <select
              id="rel"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={f.relationship}
              onChange={(e) => set("relationship", e.target.value)}
            >
              <option value="">Select…</option>
              {RELATIONSHIPS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dob">Date of birth</Label>
            <Input id="dob" type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bg">Blood group</Label>
            <Input id="bg" placeholder="O+" value={f.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sex">Sex</Label>
            <select
              id="sex"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={f.sex}
              onChange={(e) => set("sex", e.target.value as Profile["sex"])}
            >
              <option value="unspecified">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ht">Height (cm)</Label>
            <Input id="ht" type="number" value={f.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => f.name.trim() && onSubmit(f)} disabled={!f.name.trim()}>
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
