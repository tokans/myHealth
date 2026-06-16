import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FeatureGuard } from "@/components/feature/FeatureGuard";
import { isTauri } from "@/lib/environment";
import { syncEngine } from "@/sync/engine";
import { exportBundle, ingestBundle, saveSyncFile, openSyncFile } from "@/sync/transport";

/** Minimum pairing-code length — typed identically on both devices. */
const MIN_CODE = 8;

/**
 * Sync across devices (Champion tier). Device-to-device, no server: your data is
 * sealed with a pairing code you choose, written to a `.sync` file you move to your
 * other device (USB / AirDrop / shared folder), and merged there. Only the shared
 * suite data (people, medical facets, the emergency card, document/visit metadata)
 * is synced — document files stay encrypted in the vault and are never exported.
 */
function SyncInner() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = code.trim().length >= MIN_CODE && isTauri();

  const onExport = async () => {
    setBusy("export");
    setMessage(null);
    setError(null);
    try {
      const engine = await syncEngine();
      if (!engine) throw new Error("Shared data store unavailable.");
      const bytes = await exportBundle(engine, code.trim());
      await saveSyncFile(bytes, "myhealth.sync");
      setMessage("Exported. Move the .sync file to your other device and import it there with the same pairing code.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  };

  const onImport = async () => {
    setBusy("import");
    setMessage(null);
    setError(null);
    try {
      const engine = await syncEngine();
      if (!engine) throw new Error("Shared data store unavailable.");
      const bytes = await openSyncFile();
      if (!bytes) {
        setBusy(null);
        return; // user cancelled
      }
      const result = await ingestBundle(engine, bytes, code.trim());
      setMessage(`Merged: ${result.applied} updated, ${result.skipped} unchanged.`);
    } catch {
      setError("Couldn’t open that file — check the pairing code matches the other device.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sync across devices</h1>
        <p className="text-muted-foreground">
          Device-to-device, with no server. Your data is encrypted with a pairing code you both
          devices share.
        </p>
      </div>

      {!isTauri() && (
        <p className="text-xs text-muted-foreground">
          Sync runs in the desktop app — start it with <code>npm run tauri:dev</code>.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pairing code</CardTitle>
          <CardDescription>
            Choose a strong shared passphrase ({MIN_CODE}+ characters) and type the SAME one on
            both devices. It’s the only key to the sync file — keep it private and never reuse a
            weak word.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="pairing-code">Pairing code</Label>
          <Input
            id="pairing-code"
            type="password"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="shared passphrase"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exchange data</CardTitle>
          <CardDescription>
            Export this device’s data to a <code>.sync</code> file, carry it to your other device,
            and import it there with the same pairing code. Repeat the other way for a full two-way
            sync. Conflicts resolve to the most recent edit.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={onExport} disabled={!ready || busy !== null}>
            {busy === "export" ? "Exporting…" : "Export my data"}
          </Button>
          <Button variant="outline" onClick={onImport} disabled={!ready || busy !== null}>
            {busy === "import" ? "Importing…" : "Import from another device"}
          </Button>
        </CardContent>
      </Card>

      {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default function Sync() {
  return (
    <FeatureGuard gateKey="sync">
      <SyncInner />
    </FeatureGuard>
  );
}
