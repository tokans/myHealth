/**
 * Per-feature Excel export/import controls — a small Export/Import button pair for a
 * tab header (Reminders, Goals, Schedule, Medications, Vitals). Export writes a
 * human-friendly `.xlsx` the user can edit offline; Import reads one back, upserting
 * by the leading ID column (see `@/lib/featureExcel`). Desktop-only (needs the OS
 * file dialogs + DB); renders nothing meaningful in the browser preview.
 */
import { useState } from "react";
import { FileDown, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isTauri } from "@/lib/environment";
import {
  exportFeatureWorkbook,
  parseFeatureWorkbook,
  type FeatureExcelSpec,
  type ImportSummary,
} from "@/lib/featureExcel";

async function saveBytes(bytes: Uint8Array, fileName: string): Promise<boolean> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  const path = await save({
    defaultPath: fileName,
    filters: [{ name: "Excel workbook", extensions: ["xlsx"] }],
  });
  if (!path) return false;
  await writeFile(path, bytes);
  return true;
}

async function pickBytes(): Promise<Uint8Array | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const path = await open({ multiple: false, filters: [{ name: "Excel workbook", extensions: ["xlsx"] }] });
  if (!path || typeof path !== "string") return null;
  return await readFile(path);
}

function summaryLine(s: ImportSummary): string {
  const parts: string[] = [];
  if (s.added) parts.push(`${s.added} added`);
  if (s.updated) parts.push(`${s.updated} updated`);
  if (s.skipped) parts.push(`${s.skipped} skipped`);
  return parts.length ? parts.join(", ") : "No rows imported";
}

export function ExcelButtons({
  spec,
  onImported,
  className,
}: {
  spec: FeatureExcelSpec;
  /** Called after a successful import so the page can reload its data. */
  onImported?: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState<null | "export" | "import">(null);
  const [toast, setToast] = useState<{ kind: "ok" | "warn" | "error"; line: string; warnings: string[] } | null>(null);

  if (!isTauri()) return null;

  const onExport = async () => {
    setBusy("export");
    setToast(null);
    try {
      const { bytes, rowCount } = await exportFeatureWorkbook(spec);
      const saved = await saveBytes(bytes, `myHealth-${spec.key}.xlsx`);
      if (saved) {
        setToast(
          rowCount > 0
            ? { kind: "ok", line: `Exported ${rowCount} ${rowCount === 1 ? "row" : "rows"}.`, warnings: [] }
            : { kind: "warn", line: `No ${spec.label.toLowerCase()} yet — saved a blank template you can fill in and import.`, warnings: [] },
        );
      }
    } catch (e) {
      console.warn("excel export failed:", e);
      setToast({ kind: "error", line: "Export failed.", warnings: [] });
    } finally {
      setBusy(null);
    }
  };

  const onImport = async () => {
    setBusy("import");
    setToast(null);
    try {
      const bytes = await pickBytes();
      if (!bytes) { setBusy(null); return; }
      const rows = await parseFeatureWorkbook(bytes);
      const result = await spec.importRows(rows);
      setToast({
        kind: result.warnings.length ? "warn" : "ok",
        line: summaryLine(result),
        warnings: result.warnings,
      });
      onImported?.();
    } catch (e) {
      console.warn("excel import failed:", e);
      setToast({ kind: "error", line: "Import failed — is this a myHealth export?", warnings: [] });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className={className ?? "flex gap-2"}>
        <Button variant="outline" size="sm" onClick={onExport} disabled={busy != null} title={`Export ${spec.label} to Excel`}>
          {busy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={onImport} disabled={busy != null} title={`Import ${spec.label} from Excel`}>
          {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          Import
        </Button>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-20 right-4 z-50 max-w-sm rounded-lg border bg-background p-3 text-sm shadow-lg sm:bottom-4"
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className={
                toast.kind === "error"
                  ? "text-destructive"
                  : toast.kind === "warn"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
              }
            >
              {toast.line}
            </span>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setToast(null)}>
              Dismiss
            </button>
          </div>
          {toast.warnings.length > 0 && (
            <ul className="mt-2 max-h-32 list-disc space-y-0.5 overflow-auto pl-4 text-xs text-muted-foreground">
              {toast.warnings.slice(0, 12).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {toast.warnings.length > 12 && <li>…and {toast.warnings.length - 12} more.</li>}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
