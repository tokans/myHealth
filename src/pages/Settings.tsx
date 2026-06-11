import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupPanel } from "sharedcorelib/ui";
import type { ExcelBackup } from "sharedcorelib/backup";
import { isTauri } from "@/lib/environment";
import { buildExcelBackup, saveBackupFile } from "@/lib/excelBackup";
import { useProfileStore } from "@/stores/profile.store";
import { useTierStore } from "@/stores/tier.store";
import { useGatingStore } from "@/stores/gating.store";

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
    </div>
  );
}
