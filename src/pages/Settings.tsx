import { useEffect, useState } from "react";
import { Heart, Stethoscope, ExternalLink, Camera } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackupPanel } from "sharedcorelib/ui";
import type { ExcelBackup } from "sharedcorelib/backup";
import { isTauri } from "@/lib/environment";
import { useSettingsStore } from "@/stores/settings.store";
import { buildExcelBackup, saveBackupFile } from "@/lib/excelBackup";
import { openDonatePage, openPartnerSignup } from "@/lib/donate";
import {
  grantConfigured,
  grantStatus,
  importGrantFromFile,
  type GrantStatus,
} from "@/grant/receiver";
import { useProfileStore } from "@/stores/profile.store";
import { useTierStore } from "@/stores/tier.store";
import { useGatingStore } from "@/stores/gating.store";

/** A short human label for the current grant entitlement. */
function grantLabel(s: GrantStatus): string {
  if (s.supporter && s.pro) return "Supporter + Verified Pro";
  if (s.pro) return "Verified Pro";
  if (s.supporter) return "Supporter";
  return "None yet";
}

/**
 * Support myHealth — the donation (Supporter) + professional (Verified Pro) CTAs,
 * plus the receive-only grant import. Always visible: donating / enrolling are just
 * external links to tokans.org. Afterwards the user receives a signed support file
 * and imports it here — verified on-device, nothing about you is ever uploaded; a
 * donation only ACCELERATES the free ladder, it never paywalls the safety floor.
 */
function SupporterCard({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<GrantStatus>(grantStatus());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Import needs the baked signing keys (to verify) and the desktop app (to read the file).
  const canImport = grantConfigured() && isTauri();

  const onImport = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await importGrantFromFile();
      if (next) {
        setStatus(next);
        onChanged();
      } else {
        setError("No valid support file selected.");
      }
    } catch {
      setError("That file couldn’t be verified as a support file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Support myHealth</CardTitle>
        <CardDescription>
          myHealth is free and runs entirely on your device. A donation unlocks the Supporter
          tier; verified health professionals can unlock Verified Pro. Either way, nothing about
          you is ever uploaded.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          Current status: <span className="font-medium">{grantLabel(status)}</span>
        </p>

        <div className="flex flex-wrap gap-3">
          <Button className="gap-2" onClick={() => void openDonatePage()}>
            <Heart className="h-4 w-4" />
            Donate to support
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => void openPartnerSignup()}>
            <Stethoscope className="h-4 w-4" />
            Become a Verified Pro
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          After you donate or enroll, you’ll receive a signed support file. Import it below — it’s
          verified on your device and unlocks every feature.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={onImport} disabled={!canImport || busy}>
            {busy ? "Verifying…" : "Import support file"}
          </Button>
          {!canImport && (
            <span className="text-xs text-muted-foreground">
              {isTauri()
                ? "Available once support files are enabled in this build."
                : "Open the desktop app to import a support file."}
            </span>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Camera scanning — an opt-in, phone-only convenience: when on, the Documents
 * vault offers "Scan with camera" (the webview's native camera) alongside file
 * pick. Off by default; the photo is encrypted on-device like any other file.
 */
function ScanningCard() {
  const cameraScan = useSettingsStore((s) => s.cameraScan);
  const setCameraScan = useSettingsStore((s) => s.setCameraScan);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document scanning</CardTitle>
        <CardDescription>
          On phones, add a <span className="font-medium">Scan with camera</span> button to the
          Documents vault so you can photograph a prescription, lab report or card. The photo is
          encrypted on this device — nothing is uploaded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={cameraScan}
            onChange={(e) => void setCameraScan(e.target.checked)}
            data-testid="settings-camera-scan"
          />
          <span className="flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-primary" /> Enable camera scanning on mobile
          </span>
        </label>
      </CardContent>
    </Card>
  );
}

/**
 * Settings — suite-standard utility surface. First resident: the whole-store
 * Excel backup/restore (`sharedcorelib/backup` subsystem #22). Everything runs
 * on-device; the exported workbook goes only where the user saves it.
 */
export default function Settings() {
  const [backup, setBackup] = useState<ExcelBackup | null>(null);
  const refreshProfiles = useProfileStore((s) => s.refresh);
  const refreshTier = useTierStore((s) => s.refresh);
  const refreshGating = useGatingStore((s) => s.refresh);

  useEffect(() => {
    if (isTauri()) {
      buildExcelBackup().then(setBackup).catch((e) => console.warn("excel backup unavailable:", e));
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Utilities for your on-device data. Nothing here is ever sent anywhere.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backup &amp; restore</CardTitle>
          <CardDescription>
            Export everything — including this app&apos;s shared-suite tables — to one Excel
            workbook, or restore one on a new machine. Secrets export as hashes, never in the
            clear; encrypted document files stay in the vault and are not part of the workbook.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isTauri() ? (
            <p className="text-xs text-muted-foreground">
              Backup runs in the desktop app — start it with <code>npm run tauri:dev</code>.
            </p>
          ) : backup ? (
            <BackupPanel
              backup={backup}
              save={saveBackupFile}
              onImported={() => {
                void refreshProfiles();
                void refreshTier();
                void refreshGating();
              }}
              className="border-0 bg-transparent p-0"
            />
          ) : (
            <p className="text-xs text-muted-foreground">Preparing backup engine…</p>
          )}
        </CardContent>
      </Card>

      <ScanningCard />

      <SupporterCard
        onChanged={() => {
          void refreshTier();
          void refreshGating();
        }}
      />
    </div>
  );
}
