import { useEffect, useRef, useState } from "react";
import {
  FolderLock,
  Upload,
  Download,
  Trash2,
  FileText,
  Lock,
  ScanLine,
  Wand2,
  UserPlus,
  Check,
  Camera,
  ScanText,
  Loader2,
  X,
} from "lucide-react";
import { getCommonBaked } from "sharedcorelib/masters";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FeatureGuard } from "@/components/feature/FeatureGuard";
import { UnlockPanel } from "@/components/vault/UnlockPanel";
import { isTauri, isMobile } from "@/lib/environment";
import { demoSaveName } from "@/lib/demoMode";
import { useSettingsStore } from "@/stores/settings.store";
import { useVaultStore } from "@/stores/vault.store";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useProfileStore } from "@/stores/profile.store";
import { useTierStore } from "@/stores/tier.store";
import { useGatingStore } from "@/stores/gating.store";
import { vault } from "@/vault/stronghold";
import { createProfile } from "@/db/profiles";
import { listDocuments, addDocument, deleteDocument, type DocType, type DocumentRow } from "@/db/documents";
import {
  parseDocument,
  recognizeDocument,
  reconcileMembers,
  captureKindForMime,
  type ParseKind,
  type ParsedDocument,
  type Capture,
} from "@/import";
import { ocrConfigured } from "@/import/ocr/config";
import type { OcrProgress } from "@scandoc/core/ocr";

const RELATIONSHIPS = getCommonBaked("relationship"); // common master, reused (no recreate)

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "prescription", label: "Prescription" },
  { value: "lab_report", label: "Lab report" },
  { value: "insurance", label: "Insurance card" },
  { value: "discharge", label: "Discharge summary" },
  { value: "imaging", label: "Imaging / scan" },
  { value: "bill", label: "Bill" },
  { value: "id", label: "ID" },
  { value: "other", label: "Other" },
];

/** Doc types whose recognized text the field extractor can structure. */
const EXTRACTABLE: Partial<Record<DocType, ParseKind>> = {
  prescription: "prescription",
  lab_report: "lab_report",
  insurance: "insurance",
};

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

/** What the add panel is opened for: a plain add, or a typed scan that auto-extracts. */
interface AddIntent {
  type?: DocType;
  autoScan: boolean;
}

function Vaulted() {
  const { profile } = useActiveProfile();
  const profiles = useProfileStore((s) => s.profiles);
  const refreshProfiles = useProfileStore((s) => s.refresh);
  const refreshTier = useTierStore((s) => s.refresh);
  const refreshGating = useGatingStore((s) => s.refresh);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [adding, setAdding] = useState<AddIntent | null>(null);

  async function load() {
    setDocs(await listDocuments(profile?.id ?? undefined));
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function onSaved() {
    setAdding(null);
    await load();
    // New family members + a fuller vault can move tier/gating, so refresh them.
    await Promise.all([refreshProfiles(), refreshTier(), refreshGating()]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FolderLock className="h-6 w-6 text-primary" /> Documents
          </h1>
          <p className="text-muted-foreground">
            Encrypted on this device{profile ? ` · ${profile.name}` : ""}. Add or scan a report, prescription or
            insurance card.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => setAdding({ type: "insurance", autoScan: true })} data-testid="documents-scan-insurance">
            <ScanLine className="h-4 w-4" /> Scan insurance card
          </Button>
          <Button onClick={() => setAdding({ autoScan: false })} data-testid="documents-add">
            <Upload className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {adding && (
        <AddDocument
          key={adding.type ?? "add"}
          intent={adding}
          profileId={profile?.id ?? null}
          existingProfiles={profiles}
          onSaved={onSaved}
          onCancel={() => setAdding(null)}
        />
      )}

      {docs.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No documents yet. Add a prescription, lab report or scan a card.</p>
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
              <Button size="icon" variant="ghost" title="Delete" onClick={() => void removeDoc(d.id, load)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

async function exportDoc(d: DocumentRow) {
  const bytes = await vault.readBlob(d.file_name);
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  // Demo mode: skip the native dialog and write to the app-data dir unattended.
  const demoName = demoSaveName(d.title);
  if (demoName) {
    const { BaseDirectory } = await import("@tauri-apps/plugin-fs");
    await writeFile(demoName, bytes, { baseDir: BaseDirectory.AppData });
    return;
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({ defaultPath: d.title });
  if (!path) return;
  await writeFile(path, bytes);
}

async function removeDoc(id: number, reload: () => Promise<void>) {
  const row = await deleteDocument(id);
  if (row) await vault.deleteBlob(row.file_name);
  await reload();
}

interface Pending {
  bytes: Uint8Array;
  name: string;
  mime: string | null;
}

/** An editable proposed family member, derived from an insurance-card read. */
interface MemberRow {
  selected: boolean;
  name: string;
  /** "self", a relationship-master value, or "". */
  relationship: string;
  dob: string;
  memberId: string | null;
  existingId: number | null;
  existingName: string | null;
}

function AddDocument({
  intent,
  profileId,
  existingProfiles,
  onSaved,
  onCancel,
}: {
  intent: AddIntent;
  profileId: number | null;
  existingProfiles: { id: number; name: string; is_self: number }[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocType>(intent.type ?? "lab_report");
  const [provider, setProvider] = useState("");
  const [docDate, setDocDate] = useState("");
  const [recognizedText, setRecognizedText] = useState("");
  const [parsed, setParsed] = useState<ParsedDocument | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [saving, setSaving] = useState(false);
  const cameraScan = useSettingsStore((s) => s.cameraScan);
  const ocrConsent = useSettingsStore((s) => s.ocrConsent);
  const setOcrConsent = useSettingsStore((s) => s.setOcrConsent);
  const [onPhone, setOnPhone] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [ocr, setOcr] = useState<OcrProgress | null>(null);
  const [askOcr, setAskOcr] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // The camera button is offered only on a phone AND only when the user opted in.
  useEffect(() => {
    void isMobile().then(setOnPhone);
  }, []);

  // On-device OCR is available only in the desktop/mobile app with the assets configured.
  const ocrAvailable = isTauri() && ocrConfigured();
  const parseKind = EXTRACTABLE[docType];
  const hasSelf = existingProfiles.some((p) => p.is_self);

  function runExtract(text: string, kind: ParseKind, source: Capture["source"]) {
    const result = parseDocument(kind, text, { source });
    setParsed(result);
    if (result.kind === "insurance") {
      const proposals = reconcileMembers(
        result.members,
        existingProfiles.map((p) => ({ id: p.id, name: p.name, is_self: p.is_self })),
      );
      setMembers(
        proposals.map((p) => ({
          selected: p.selected,
          name: p.member.name ?? "",
          relationship: p.member.relationship ?? "",
          dob: p.member.dob ?? "",
          memberId: p.member.memberId,
          existingId: p.existingId,
          existingName: p.existingName,
        })),
      );
    } else {
      setMembers([]);
    }
  }

  /** Ingest picked/captured bytes: stage them, then recognize (OCR if applicable). */
  async function acceptDocument(bytes: Uint8Array, name: string, mime: string | null) {
    setPending({ bytes, name, mime });
    if (!title) setTitle(name);
    setParsed(null);
    setMembers([]);
    setAskOcr(false);

    const kind = captureKindForMime(mime, name);
    const ocrCandidate = (kind === "photo" || kind === "scanned-pdf") && !!parseKind;

    // First image/PDF scan needs one-time consent before the ~10MB language download.
    if (ocrCandidate && ocrAvailable && !ocrConsent) {
      const { ocrLangProvisioned } = await import("@/import/ocr");
      if (!(await ocrLangProvisioned())) {
        setCapture({ text: "", source: "ocr", kind, needsOcr: true });
        setRecognizedText("");
        setAskOcr(true);
        return;
      }
    }

    await runRecognize(bytes, mime, name, ocrCandidate && ocrAvailable);
  }

  /** Recognize text (with OCR progress + cancel when `runOcr`), then auto-extract on scan. */
  async function runRecognize(bytes: Uint8Array, mime: string | null, name: string, runOcr: boolean) {
    setAskOcr(false);
    const ctrl = runOcr ? new AbortController() : null;
    abortRef.current = ctrl;
    if (runOcr) setOcr({ phase: "download", received: 0 });
    try {
      const cap = await recognizeDocument(bytes, mime, name, {
        onProgress: setOcr,
        signal: ctrl?.signal,
      });
      setCapture(cap);
      setRecognizedText(cap.text);
      if (intent.autoScan && parseKind && cap.text.trim()) {
        runExtract(cap.text, parseKind, cap.source);
      }
    } catch {
      // Cancelled or OCR failed — fall back to the paste path.
      setCapture({ text: "", source: "ocr", kind: captureKindForMime(mime, name), needsOcr: true });
      setRecognizedText("");
    } finally {
      setOcr(null);
      abortRef.current = null;
    }
  }

  /** User granted the one-time OCR download consent: persist it and read the staged file. */
  async function enableOcr() {
    await setOcrConsent(true);
    if (pending) await runRecognize(pending.bytes, pending.mime, pending.name, true);
  }

  async function pickFile() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({ multiple: false });
    if (!path || typeof path !== "string") return;
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const bytes = await readFile(path);
    const name = path.split(/[\\/]/).pop() ?? "document";
    await acceptDocument(bytes, name, guessMime(name));
  }

  /**
   * Mobile camera capture via the webview's native file input (`capture` opens the
   * camera on Android/iOS) — no Rust plugin, and the photo bytes never leave the
   * device: they flow straight into the same encrypt-on-save path as a picked file.
   */
  async function onCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-capturing the same-named file
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = file.name || `scan-${docType}.jpg`;
    await acceptDocument(bytes, name, file.type || guessMime(name));
  }

  function setMember(i: number, patch: Partial<MemberRow>) {
    setMembers((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!pending) return;
    setSaving(true);
    try {
      // 1) Propose-then-confirm: create the checked members that aren't already in the family.
      if (parsed?.kind === "insurance") {
        let selfTaken = hasSelf;
        for (const m of members) {
          if (!m.selected || m.existingId != null || !m.name.trim()) continue;
          const isSelfRow = m.relationship === "self";
          await createProfile({
            name: m.name.trim(),
            is_self: isSelfRow && !selfTaken ? 1 : 0,
            relationship: isSelfRow ? null : m.relationship || null,
            dob: m.dob || undefined,
          });
          if (isSelfRow && !selfTaken) selfTaken = true;
        }
      }

      // 2) Seal the document blob and record its metadata (extracted text kept for search).
      const fileName = await vault.saveBlob(pending.bytes);
      await addDocument({
        profile_id: profileId,
        doc_type: docType,
        title: title.trim() || pending.name,
        provider: provider || undefined,
        doc_date: docDate || undefined,
        file_name: fileName,
        mime: pending.mime ?? undefined,
        size_bytes: pending.bytes.length,
        extracted_text: parsed ? summarize(parsed) : null,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const selectedToAdd = members.filter((m) => m.selected && m.existingId == null).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {intent.autoScan ? <ScanLine className="h-5 w-5 text-primary" /> : <Upload className="h-5 w-5 text-primary" />}
          {intent.type === "insurance" ? "Scan insurance card" : "Add document"}
        </CardTitle>
        <CardDescription>
          {pending
            ? `${pending.name} · ${Math.ceil(pending.bytes.length / 1024)} KB · encrypted on save`
            : "Choose a file (PDF, image or text). Bytes stay encrypted on this device — nothing is uploaded."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!pending ? (
          <div className="flex flex-wrap gap-2" data-testid="documents-add-panel">
            <Button onClick={pickFile} data-testid="documents-choose-file">
              <Upload className="h-4 w-4" /> Choose file
            </Button>
            {onPhone && cameraScan && (
              <Button
                variant="secondary"
                onClick={() => cameraInputRef.current?.click()}
                data-testid="documents-scan-camera"
              >
                <Camera className="h-4 w-4" /> Scan with camera
              </Button>
            )}
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void onCameraCapture(e)}
            />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="dtitle">Title</Label>
              <Input id="dtitle" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dtype">Type</Label>
                <select
                  id="dtype"
                  aria-label="Document type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={docType}
                  onChange={(e) => {
                    setDocType(e.target.value as DocType);
                    setParsed(null);
                    setMembers([]);
                  }}
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ddate">Date</Label>
                <Input id="ddate" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dprov">Provider / insurer (optional)</Label>
              <Input id="dprov" value={provider} onChange={(e) => setProvider(e.target.value)} />
            </div>

            {parseKind && (
              <div className="space-y-2 rounded-md border border-dashed p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rtext" className="flex items-center gap-1.5">
                    <Wand2 className="h-4 w-4 text-primary" /> Scan &amp; extract
                  </Label>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!recognizedText.trim() || !!ocr}
                    onClick={() => runExtract(recognizedText, parseKind, capture?.source ?? "ocr")}
                  >
                    Extract fields
                  </Button>
                </div>
                {askOcr ? (
                  <div className="space-y-2 rounded-md bg-muted/40 p-2.5 text-xs">
                    <p className="flex items-center gap-1.5 font-medium">
                      <ScanText className="h-4 w-4 text-primary" /> Read text from this{" "}
                      {intent.type === "insurance" ? "card" : "document"} on your device?
                    </p>
                    <p className="text-muted-foreground">
                      Downloads ~10&nbsp;MB of English text-recognition data once, then works offline. It runs entirely
                      on this device — nothing is uploaded.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void enableOcr()}>
                        <ScanText className="h-4 w-4" /> Enable on-device OCR
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAskOcr(false)}>
                        Not now
                      </Button>
                    </div>
                  </div>
                ) : ocr ? (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 p-2 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {ocr.phase === "download"
                        ? `Downloading text-recognition data${
                            ocr.total ? ` (${Math.round(((ocr.received ?? 0) / ocr.total) * 100)}%)` : "…"
                          }`
                        : `Reading text${ocr.received != null ? ` (${Math.round((ocr.received ?? 0) * 100)}%)` : "…"}`}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}>
                      <X className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  </div>
                ) : capture?.needsOcr ? (
                  <p className="text-xs text-muted-foreground">
                    {ocrAvailable
                      ? "No text could be read automatically. Paste or type the text"
                      : "Automatic text reading isn’t available here. Paste or type the text"}{" "}
                    from the {intent.type === "insurance" ? "card" : "document"} below, then extract.
                  </p>
                ) : null}
                <textarea
                  id="rtext"
                  className="min-h-[96px] w-full rounded-md border border-input bg-background p-2 text-xs"
                  placeholder="Recognized text appears here — edit or paste, then Extract fields."
                  value={recognizedText}
                  onChange={(e) => setRecognizedText(e.target.value)}
                />
                {parsed?.kind === "insurance" && (
                  <InsuranceReview
                    parsed={parsed}
                    members={members}
                    onMember={setMember}
                  />
                )}
                {parsed && parsed.kind !== "insurance" && <ItemsReview parsed={parsed} />}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={saving}>
                <Check className="h-4 w-4" />
                {selectedToAdd > 0 ? `Save & add ${selectedToAdd} member${selectedToAdd > 1 ? "s" : ""}` : "Save"}
              </Button>
              <Button variant="ghost" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InsuranceReview({
  parsed,
  members,
  onMember,
}: {
  parsed: Extract<ParsedDocument, { kind: "insurance" }>;
  members: MemberRow[];
  onMember: (i: number, patch: Partial<MemberRow>) => void;
}) {
  const p = parsed.policy;
  const policyBits = [
    p.insurer && `Insurer: ${p.insurer}`,
    p.policyNumber && `Policy ${p.policyNumber}`,
    (p.validFrom || p.validThrough) && `Valid ${p.validFrom ?? "?"} → ${p.validThrough ?? "?"}`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-2">
      {policyBits.length > 0 && <p className="text-xs text-muted-foreground">{policyBits.join(" · ")}</p>}
      {members.length === 0 ? (
        <p className="text-xs text-muted-foreground">No members detected. Edit the text above and extract again.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium">
            <UserPlus className="mr-1 inline h-3.5 w-3.5" /> Members on this card — confirm who to add to your family.
          </p>
          {members.map((m, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2">
              <input
                type="checkbox"
                checked={m.selected}
                disabled={m.existingId != null}
                onChange={(e) => onMember(i, { selected: e.target.checked })}
                title={m.existingId != null ? "Already in your family" : "Add to family"}
              />
              <Input
                className="h-8 w-40"
                value={m.name}
                onChange={(e) => onMember(i, { name: e.target.value })}
                placeholder="Name"
              />
              <select
                aria-label={`Relationship for ${m.name || "member"}`}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={m.relationship}
                onChange={(e) => onMember(i, { relationship: e.target.value })}
                disabled={m.existingId != null}
              >
                <option value="">Relationship…</option>
                <option value="self">You (self)</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <Input
                className="h-8 w-36"
                type="date"
                value={m.dob}
                onChange={(e) => onMember(i, { dob: e.target.value })}
              />
              {m.existingId != null ? (
                <span className="text-xs text-muted-foreground">Already in family</span>
              ) : (
                m.memberId && <span className="text-xs text-muted-foreground">ID {m.memberId}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Read-only confidence-tiered summary of extracted prescription / lab fields. */
function ItemsReview({ parsed }: { parsed: Extract<ParsedDocument, { kind: "prescription" | "lab_report" }> }) {
  const rows =
    parsed.kind === "prescription"
      ? parsed.items.map((it) => ({ label: it.drug ?? it.rawName, detail: [it.strength, it.frequency].filter(Boolean).join(" · "), tier: it.tier }))
      : parsed.items.map((it) => ({ label: it.test ?? it.rawName, detail: [it.value, it.unit].filter((v) => v != null).join(" "), tier: it.tier }));
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No fields detected yet.</p>;
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">
        {rows.length} field{rows.length > 1 ? "s" : ""} detected · confirm-required, saved with the document.
      </p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1 text-xs">
          <span className="font-medium">{r.label || "—"}</span>
          <span className="text-muted-foreground">
            {r.detail} {r.tier !== "auto" && <em>· {r.tier}</em>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A compact, searchable text summary of an extraction (never the blob bytes). */
function summarize(parsed: ParsedDocument): string {
  if (parsed.kind === "insurance") {
    const p = parsed.policy;
    const head = [p.insurer, p.policyNumber && `Policy ${p.policyNumber}`].filter(Boolean).join(" · ");
    const mem = parsed.members.map((m) => `${m.name}${m.relationship ? ` (${m.relationship})` : ""}`).join(", ");
    return [head, mem && `Members: ${mem}`].filter(Boolean).join("\n");
  }
  if (parsed.kind === "prescription") {
    return parsed.items.map((it) => [it.drug ?? it.rawName, it.strength, it.frequency].filter(Boolean).join(" ")).join("\n");
  }
  return parsed.items.map((it) => [it.test ?? it.rawName, it.value, it.unit].filter((v) => v != null).join(" ")).join("\n");
}

function guessMime(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "txt":
      return "text/plain";
    default:
      return null;
  }
}
