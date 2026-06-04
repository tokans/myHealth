import { useEffect, useState } from "react";
import { FolderLock, Upload, Download, Trash2, FileText, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FeatureGuard } from "@/components/feature/FeatureGuard";
import { UnlockPanel } from "@/components/vault/UnlockPanel";
import { isTauri } from "@/lib/environment";
import { useVaultStore } from "@/stores/vault.store";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { vault } from "@/vault/stronghold";
import { listDocuments, addDocument, deleteDocument, type DocType, type DocumentRow } from "@/db/documents";

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "prescription", label: "Prescription" },
  { value: "lab_report", label: "Lab report" },
  { value: "discharge", label: "Discharge summary" },
  { value: "imaging", label: "Imaging / scan" },
  { value: "insurance", label: "Insurance" },
  { value: "bill", label: "Bill" },
  { value: "id", label: "ID" },
  { value: "other", label: "Other" },
];

export default function Documents() {
  return (
    <FeatureGuard gateKey="documents">
      <DocumentsInner />
    </FeatureGuard>
  );
}

function DocumentsInner() {
  const { unlocked } = useVaultStore();
  if (!isTauri()) return <p className="text-sm text-muted-foreground">The document vault is available in the desktop app.</p>;
  if (!unlocked) {
    return (
      <div className="space-y-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FolderLock className="h-6 w-6 text-primary" /> Documents
        </h1>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> Your documents are encrypted on this device.
        </p>
        <UnlockPanel />
      </div>
    );
  }
  return <Vaulted />;
}

interface Pending {
  bytes: Uint8Array;
  name: string;
  mime: string | null;
}

function Vaulted() {
  const { profile } = useActiveProfile();
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);

  async function load() {
    setDocs(await listDocuments(profile?.id ?? undefined));
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function pickFile() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({ multiple: false });
    if (!path || typeof path !== "string") return;
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const bytes = await readFile(path);
    const name = path.split(/[\\/]/).pop() ?? "document";
    setPending({ bytes, name, mime: guessMime(name) });
  }

  async function savePending(meta: { title: string; doc_type: DocType; provider: string; doc_date: string }) {
    if (!pending) return;
    const fileName = await vault.saveBlob(pending.bytes); // sealed with the per-device DEK
    await addDocument({
      profile_id: profile?.id ?? null,
      doc_type: meta.doc_type,
      title: meta.title || pending.name,
      provider: meta.provider || undefined,
      doc_date: meta.doc_date || undefined,
      file_name: fileName,
      mime: pending.mime ?? undefined,
      size_bytes: pending.bytes.length,
    });
    setPending(null);
    await load();
  }

  async function exportDoc(d: DocumentRow) {
    const bytes = await vault.readBlob(d.file_name);
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: d.title });
    if (!path) return;
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(path, bytes);
  }

  async function removeDoc(id: number) {
    const row = await deleteDocument(id);
    if (row) await vault.deleteBlob(row.file_name);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FolderLock className="h-6 w-6 text-primary" /> Documents
          </h1>
          <p className="text-muted-foreground">
            Encrypted on this device{profile ? ` · ${profile.name}` : ""}.
          </p>
        </div>
        <Button onClick={pickFile}>
          <Upload className="h-4 w-4" /> Add
        </Button>
      </div>

      {pending && <MetaForm pending={pending} onSave={savePending} onCancel={() => setPending(null)} />}

      {docs.length === 0 && !pending && (
        <p className="text-sm text-muted-foreground">No documents yet. Add a prescription, lab report or scan.</p>
      )}

      <div className="grid gap-2">
        {docs.map((d) => (
          <Card key={d.id}>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent">
                <FileText className="h-4 w-4 text-accent-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{d.title}</div>
                <div className="text-xs text-muted-foreground">
                  {[DOC_TYPES.find((t) => t.value === d.doc_type)?.label, d.provider, d.doc_date]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <Button size="icon" variant="ghost" title="Export" onClick={() => exportDoc(d)}>
                <Download className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button size="icon" variant="ghost" title="Delete" onClick={() => removeDoc(d.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MetaForm({
  pending,
  onSave,
  onCancel,
}: {
  pending: Pending;
  onSave: (m: { title: string; doc_type: DocType; provider: string; doc_date: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(pending.name);
  const [docType, setDocType] = useState<DocType>("lab_report");
  const [provider, setProvider] = useState("");
  const [docDate, setDocDate] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add document</CardTitle>
        <CardDescription>{pending.name} · {Math.ceil(pending.bytes.length / 1024)} KB · encrypted on save</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="dtitle">Title</Label>
          <Input id="dtitle" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dtype">Type</Label>
            <select id="dtype" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={docType} onChange={(e) => setDocType(e.target.value as DocType)}>
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ddate">Date</Label>
            <Input id="ddate" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dprov">Provider (optional)</Label>
          <Input id="dprov" value={provider} onChange={(e) => setProvider(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onSave({ title, doc_type: docType, provider, doc_date: docDate })}>Save</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function guessMime(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    default: return null;
  }
}
