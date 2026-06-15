import { useMemo, useState } from "react";
import { Flower2, Clock, ChevronLeft, Download, Loader2, Package, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FeatureGuard } from "@/components/feature/FeatureGuard";
import { isTauri } from "@/lib/environment";
import { useYogaStore } from "@/stores/yoga.store";
import { checkYogaUpdates, yogaUpdatesConfigured, YOGA_RELEASE_BASE_URL } from "@/masters/yoga";
import {
  SAMPLE_SEQUENCES,
  mergeSequences,
  totalDurationSec,
  formatDuration,
  stepImage,
  type YogaSequence,
  type YogaLevel,
} from "@/domain/yoga";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<YogaLevel, string> = {
  beginner: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  advanced: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

export default function Yoga() {
  return (
    <FeatureGuard gateKey="yoga">
      <YogaInner />
    </FeatureGuard>
  );
}

function YogaInner() {
  const bundles = useYogaStore((s) => s.bundles);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sequences = useMemo(() => {
    const downloaded: YogaSequence[] = bundles.flatMap((b) =>
      b.sequences.map((seq) => ({ ...seq, source: "bundle" as const, bundleId: b.bundleId })),
    );
    return mergeSequences(SAMPLE_SEQUENCES, downloaded);
  }, [bundles]);
  const selected = sequences.find((s) => s.id === selectedId) ?? null;

  if (selected) {
    return <SequenceDetail sequence={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Flower2 className="h-6 w-6 text-primary" /> Yoga
        </h1>
        <p className="text-muted-foreground">
          Guided sequences with step-by-step poses. Pick one and follow along at your own pace.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sequences.map((seq) => (
          <SequenceCard key={seq.id} sequence={seq} onOpen={() => setSelectedId(seq.id)} />
        ))}
      </div>

      <BundleManager bundleCount={bundles.length} />

      <p className="text-xs text-muted-foreground">
        These are general movement guides, not medical advice or physiotherapy. Move gently, stop if
        anything hurts, and check with your doctor before starting if you have an injury or condition.
      </p>
    </div>
  );
}

function SequenceCard({ sequence, onOpen }: { sequence: YogaSequence; onOpen: () => void }) {
  const first = sequence.steps[0];
  const img = first ? stepImage(first) : undefined;
  return (
    <Card className="cursor-pointer transition-colors hover:bg-accent/40" onClick={onOpen}>
      <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
        {img && (
          <img
            src={img}
            alt=""
            className="h-14 w-16 shrink-0 rounded-md bg-secondary/60 p-1 text-primary"
          />
        )}
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">{sequence.name}</CardTitle>
          <CardDescription className="line-clamp-2">{sequence.summary}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 pt-0 text-xs">
        <span className={cn("rounded px-1.5 py-0.5 font-medium capitalize", LEVEL_STYLE[sequence.level])}>
          {sequence.level}
        </span>
        <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">{sequence.focus}</span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" /> {formatDuration(totalDurationSec(sequence))}
        </span>
        <span className="text-muted-foreground">· {sequence.steps.length} steps</span>
        {sequence.source === "bundle" && (
          <span className="ml-auto flex items-center gap-1 text-muted-foreground">
            <Package className="h-3 w-3" /> bundle
          </span>
        )}
      </CardContent>
    </Card>
  );
}

function SequenceDetail({ sequence, onBack }: { sequence: YogaSequence; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All sequences
      </button>

      <div>
        <h1 className="text-2xl font-semibold">{sequence.name}</h1>
        {sequence.sanskrit && <p className="text-sm italic text-muted-foreground">{sequence.sanskrit}</p>}
        <p className="mt-1 text-muted-foreground">{sequence.summary}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("rounded px-1.5 py-0.5 font-medium capitalize", LEVEL_STYLE[sequence.level])}>
            {sequence.level}
          </span>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">{sequence.focus}</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" /> {formatDuration(totalDurationSec(sequence))}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {sequence.steps.map((step, i) => {
          const img = stepImage(step);
          return (
            <Card key={i}>
              <CardContent className="flex gap-4 p-4">
                <div className="flex flex-col items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {i + 1}
                  </span>
                  {img && (
                    <img src={img} alt={step.title} className="h-20 w-24 rounded-md bg-secondary/60 p-1 text-primary" />
                  )}
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
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Move within a comfortable range and breathe steadily. This is guidance only, not medical advice.
      </p>
    </div>
  );
}

/** Download / manage separately-published yoga bundles from the GitHub release. */
function BundleManager({ bundleCount }: { bundleCount: number }) {
  const removeBundle = useYogaStore((s) => s.removeBundle);
  const bundles = useYogaStore((s) => s.bundles);
  const [status, setStatus] = useState<"idle" | "checking" | "done" | "none">("idle");

  async function onCheck() {
    setStatus("checking");
    const applied = await checkYogaUpdates({ force: true });
    setStatus(applied ? "done" : "none");
  }

  const configured = yogaUpdatesConfigured();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="h-4 w-4 text-primary" /> Sequence bundles
        </CardTitle>
        <CardDescription>
          More sequences are published as separate, signed bundles you can download from the release
          site. {bundleCount > 0 ? `${bundleCount} installed.` : "None downloaded yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {bundles.length > 0 && (
          <ul className="space-y-1.5">
            {bundles.map((b) => (
              <li key={b.bundleId} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{b.name}</span>
                  <span className="text-xs text-muted-foreground">
                    v{b.version} · {b.sequences.length} seq
                  </span>
                </span>
                <Button size="icon" variant="ghost" title="Remove bundle" onClick={() => removeBundle(b.bundleId)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={onCheck} disabled={status === "checking" || !configured || !isTauri()}>
            {status === "checking" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Check for bundles
          </Button>
          {status === "done" && <span className="text-sm text-emerald-600">New sequences added.</span>}
          {status === "none" && <span className="text-sm text-muted-foreground">No new bundles found.</span>}
        </div>

        {!configured ? (
          <p className="text-xs text-muted-foreground">
            Downloads aren't configured in this build. Bundles are verified, signed packs pulled from{" "}
            the project's GitHub release.
          </p>
        ) : !isTauri() ? (
          <p className="text-xs text-muted-foreground">
            Open the desktop app to download bundles (the browser preview can't fetch them).
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Pulled from <span className="break-all font-mono text-[11px]">{YOGA_RELEASE_BASE_URL}</span>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
