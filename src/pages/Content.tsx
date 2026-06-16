import { useMemo, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { Clock, ChevronLeft, Download, Loader2, Package, Plus, Check, Trash2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGatingStore } from "@/stores/gating.store";
import { tierVisibility, type EarnedTier } from "@/lib/featureGate";
import { useContentTypes, findContentType } from "@/content/registry";
import { useContentStore } from "@/stores/content.store";
import { checkTypeNow, contentUpdatesConfigured, contentSyncAvailable } from "@/content/updater";
import {
  mergeEntries,
  bundleEntries,
  buildNodeTree,
  nodeAt,
  nodeEntries,
  totalDurationSec,
  formatDuration,
  stepImage,
  type ContentType,
  type ContentEntry,
  type ContentLevel,
} from "@/content/model";
import { ContentTreeNav } from "@/components/content/ContentTreeNav";
import { cn } from "@/lib/utils";

const TIER_LABEL: Record<EarnedTier, string> = { tracker: "Tracker", caretaker: "Caretaker", champion: "Champion" };

const LEVEL_STYLE: Record<ContentLevel, string> = {
  beginner: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  advanced: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

export default function Content() {
  const { type: typeKey } = useParams();
  const types = useContentTypes();
  const flags = useGatingStore();
  const type = findContentType(types, typeKey);

  if (!type) return <Navigate to="/" replace />;
  if (tierVisibility(type.tier, flags) !== "open") return <ContentLocked type={type} />;
  return <ContentInner type={type} />;
}

function ContentLocked({ type }: { type: ContentType }) {
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <CardHeader className="items-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent">
          <Lock className="h-5 w-5 text-accent-foreground" />
        </div>
        <CardTitle>{type.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Reach the {TIER_LABEL[type.tier]} tier to unlock {type.label}.
        </p>
        <Button asChild>
          <Link to="/journey">View your journey</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ContentInner({ type }: { type: ContentType }) {
  const bundles = useContentStore((s) => s.bundlesByType[type.key]);
  const [path, setPath] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A type's content is a node tree: its `tree` (subtypes) or a single root leaf
  // built from its flat samples. The breadcrumb dropdown walks it; leaves list entries.
  const root = useMemo(
    () => type.tree ?? buildNodeTree({ key: type.key, label: type.label, entries: type.samples }),
    [type],
  );
  const current = useMemo(() => nodeAt(root, path) ?? root, [root, path]);
  const hasSubtypes = root.children.length > 0;

  // Entries for the current node; downloaded bundles surface at the root level.
  const entries = useMemo(
    () => mergeEntries(nodeEntries(current), current === root ? bundleEntries(bundles ?? []) : []),
    [current, root, bundles],
  );
  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const Icon = type.icon;

  if (selected) {
    return <EntryDetail type={type} entry={selected} onBack={() => setSelectedId(null)} />;
  }

  const navigate = (p: string[]) => {
    setPath(p);
    setSelectedId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Icon className="h-6 w-6 text-primary" /> {type.label}
        </h1>
        <p className="text-muted-foreground">
          {type.description ?? `Guided ${type.entryNoun}s, step by step. Pick one and follow along at your own pace.`}
        </p>
      </div>

      {hasSubtypes && <ContentTreeNav root={root} path={path} onNavigate={navigate} />}

      {entries.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onOpen={() => setSelectedId(entry.id)} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {current.children.length > 0
            ? `Choose a section above to see ${type.entryNoun}s.`
            : `No ${type.entryNoun}s here yet.`}
        </p>
      )}

      <BundleManager type={type} />

      <p className="text-xs text-muted-foreground">
        These are general movement guides, not medical advice or physiotherapy. Move gently, stop if
        anything hurts, and check with your doctor before starting if you have an injury or condition.
      </p>
    </div>
  );
}

function EntryCard({ entry, onOpen }: { entry: ContentEntry; onOpen: () => void }) {
  const first = entry.steps[0];
  const img = first ? stepImage(first) : undefined;
  return (
    <Card className="cursor-pointer transition-colors hover:bg-accent/40" onClick={onOpen}>
      <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
        {img && <img src={img} alt="" className="h-14 w-16 shrink-0 rounded-md bg-secondary/60 p-1 text-primary" />}
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">{entry.name}</CardTitle>
          <CardDescription className="line-clamp-2">{entry.summary}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 pt-0 text-xs">
        {entry.level && (
          <span className={cn("rounded px-1.5 py-0.5 font-medium capitalize", LEVEL_STYLE[entry.level])}>
            {entry.level}
          </span>
        )}
        {entry.focus && <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">{entry.focus}</span>}
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" /> {formatDuration(totalDurationSec(entry))}
        </span>
        <span className="text-muted-foreground">· {entry.steps.length} steps</span>
        {entry.source === "bundle" && (
          <span className="ml-auto flex items-center gap-1 text-muted-foreground">
            <Package className="h-3 w-3" /> bundle
          </span>
        )}
      </CardContent>
    </Card>
  );
}

function EntryDetail({ type, entry, onBack }: { type: ContentType; entry: ContentEntry; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All {type.entryNoun}s
      </button>

      <div>
        <h1 className="text-2xl font-semibold">{entry.name}</h1>
        <p className="mt-1 text-muted-foreground">{entry.summary}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {entry.level && (
            <span className={cn("rounded px-1.5 py-0.5 font-medium capitalize", LEVEL_STYLE[entry.level])}>
              {entry.level}
            </span>
          )}
          {entry.focus && <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">{entry.focus}</span>}
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" /> {formatDuration(totalDurationSec(entry))}
          </span>
        </div>
      </div>

      <ol className="space-y-3">
        {entry.steps.map((step, i) => {
          const img = stepImage(step);
          return (
            <li key={i}>
              <Card>
                <CardContent className="flex gap-4 p-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {i + 1}
                    </span>
                    {img && <img src={img} alt={step.title} className="h-20 w-24 rounded-md bg-secondary/60 p-1 text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium">{step.title}</h3>
                      {step.durationSec != null && (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> {formatDuration(step.durationSec)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{step.instruction}</p>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-muted-foreground">
        Move within a comfortable range and breathe steadily. This is guidance only, not medical advice.
      </p>
    </div>
  );
}

/** Browse / install / remove the separately-published bundles for this content type. */
function BundleManager({ type }: { type: ContentType }) {
  const installed = useContentStore((s) => s.bundlesByType[type.key]) ?? [];
  const availableBundles = useContentStore((s) => s.availableByType[type.key]) ?? [];
  const installBundle = useContentStore((s) => s.installBundle);
  const removeBundle = useContentStore((s) => s.removeBundle);
  const [status, setStatus] = useState<"idle" | "checking" | "done" | "none">("idle");

  async function onCheck() {
    setStatus("checking");
    const found = await checkTypeNow(type);
    setStatus(found ? "done" : "none");
  }

  const configured = contentUpdatesConfigured();
  const canSync = contentSyncAvailable();

  // One row per bundle: the install catalog ⊕ anything still installed, installed-state flagged.
  const installedIds = new Set(installed.map((b) => b.bundleId));
  const rows = new Map<string, { bundle: (typeof installed)[number]; installed: boolean }>();
  for (const b of availableBundles) rows.set(b.bundleId, { bundle: b, installed: installedIds.has(b.bundleId) });
  for (const b of installed) rows.set(b.bundleId, { bundle: b, installed: true });
  const list = [...rows.values()].sort((a, b) => a.bundle.name.localeCompare(b.bundle.name));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="h-4 w-4 text-primary" /> {type.label} bundles
        </CardTitle>
        <CardDescription>
          Extra {type.entryNoun}s are published as separate, signed bundles. Tap one to add it.
          {installed.length > 0 ? ` ${installed.length} installed.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.length > 0 && (
          <ul className="space-y-1.5">
            {list.map(({ bundle: b, installed: isInstalled }) => (
              <li
                key={b.bundleId}
                onClick={() => !isInstalled && installBundle(type.key, b.bundleId)}
                className={cn(
                  "flex items-center justify-between rounded-md border p-2 text-sm",
                  !isInstalled && "cursor-pointer hover:bg-accent/40",
                )}
              >
                <span className="flex items-center gap-2">
                  <Package className={cn("h-4 w-4", isInstalled ? "text-primary" : "text-muted-foreground")} />
                  <span className="font-medium">{b.name}</span>
                  <span className="text-xs text-muted-foreground">
                    v{b.version} · {b.entries.length} {type.entryNoun}
                  </span>
                </span>
                {isInstalled ? (
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <Check className="h-3.5 w-3.5" /> Added
                    </span>
                    <Button size="icon" variant="ghost" title="Remove bundle" onClick={(e) => { e.stopPropagation(); removeBundle(type.key, b.bundleId); }}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" title="Add bundle" onClick={(e) => { e.stopPropagation(); installBundle(type.key, b.bundleId); }}>
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={onCheck} disabled={status === "checking" || !canSync}>
            {status === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Check now
          </Button>
          {status === "done" && <span className="text-sm text-muted-foreground">Catalog refreshed — tap a bundle to add it.</span>}
          {status === "none" && <span className="text-sm text-muted-foreground">No bundles found.</span>}
        </div>

        {!configured ? (
          <p className="text-xs text-muted-foreground">
            Downloads aren't configured in this build. Run <span className="font-mono text-[11px]">npm run content:dev</span> to
            build, sign &amp; serve sample bundles locally and set the keys, then reload.
          </p>
        ) : !canSync ? (
          <p className="text-xs text-muted-foreground">
            Open the desktop app to download bundles, or use the <span className="font-mono text-[11px]">npm run dev</span> preview
            with <span className="font-mono text-[11px]">npm run content:dev</span> running.
          </p>
        ) : list.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Tap <strong>Check now</strong> to fetch the latest {type.entryNoun} bundles from the{" "}
            <span className="font-mono text-[11px]">{type.releaseTag}</span> release.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            From the <span className="font-mono text-[11px]">{type.releaseTag}</span> release; the catalog refreshes daily.
            Removing a bundle keeps it here to re-add.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
