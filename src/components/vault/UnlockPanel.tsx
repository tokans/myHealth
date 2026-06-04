import { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVaultStore } from "@/stores/vault.store";

/** Gate for vault-backed surfaces: set (first run) or enter the master password. */
export function UnlockPanel() {
  const { exists, checked, check, unlock } = useVaultStore();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!checked) void check();
  }, [checked, check]);

  const creating = !exists;

  async function submit() {
    setErr("");
    if (creating && pw !== confirm) {
      setErr("Passwords don't match.");
      return;
    }
    if (pw.length < 6) {
      setErr("Use at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      await unlock(pw);
    } catch {
      setErr(creating ? "Couldn't create the vault." : "Wrong password.");
    } finally {
      setBusy(false);
      setPw("");
      setConfirm("");
    }
  }

  return (
    <Card className="mx-auto mt-10 max-w-md">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent">
          {creating ? <ShieldCheck className="h-5 w-5 text-accent-foreground" /> : <Lock className="h-5 w-5 text-accent-foreground" />}
        </div>
        <CardTitle>{creating ? "Set a master password" : "Unlock your vault"}</CardTitle>
        <CardDescription>
          {creating
            ? "This encrypts your documents on this device. There's no recovery — keep it safe."
            : "Enter your master password to access your encrypted documents."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="pw">Master password</Label>
          <Input id="pw" type="password" value={pw} autoFocus
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => !creating && e.key === "Enter" && submit()} />
        </div>
        {creating && (
          <div className="space-y-1.5">
            <Label htmlFor="cpw">Confirm password</Label>
            <Input id="cpw" type="password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button className="w-full" onClick={submit} disabled={busy || !pw}>
          {busy ? "Working…" : creating ? "Create vault" : "Unlock"}
        </Button>
      </CardContent>
    </Card>
  );
}
