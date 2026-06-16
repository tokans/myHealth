import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from "recharts";
import { LineChart as LineChartIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FeatureGuard } from "@/components/feature/FeatureGuard";
import { isTauri } from "@/lib/environment";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { listMetrics } from "@/db/metrics";
import { METRIC_KINDS, metricKind } from "@/lib/metricKinds";
import {
  referenceRange,
  summariseSeries,
  type RangeFlag,
  type TrendPoint,
  type TrendSummary,
} from "@/domain/trends";
import { cn } from "@/lib/utils";

export default function Trends() {
  return (
    <FeatureGuard gateKey="trends">
      <TrendsInner />
    </FeatureGuard>
  );
}

function TrendsInner() {
  const { profile } = useActiveProfile();
  const [kind, setKind] = useState(METRIC_KINDS[0]!.kind);
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const meta = metricKind(kind)!;

  useEffect(() => {
    (async () => {
      if (!profile || !isTauri()) {
        setPoints([]);
        return;
      }
      const rows = await listMetrics(profile.id, kind);
      setPoints(rows.map((m) => ({ date: m.taken_at.slice(0, 10), value: m.value })));
    })();
  }, [profile?.id, kind]);

  const summary = useMemo(() => summariseSeries(meta, points), [meta, points]);
  const range = referenceRange(kind);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <LineChartIcon className="h-6 w-6 text-primary" /> Trends
        </h1>
        <p className="text-muted-foreground">
          {profile ? `Charting ${profile.name}'s readings.` : "Create a profile first."}
        </p>
      </div>

      {profile && (
        <Card>
          <CardHeader className="pb-2">
            <div className="space-y-1.5">
              <Label htmlFor="trend-kind">Metric</Label>
              <select
                id="trend-kind"
                data-testid="trends-kind"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {METRIC_KINDS.map((m) => (
                  <option key={m.kind} value={m.kind}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {points.length < 2 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {points.length === 0
                  ? `No ${meta.label.toLowerCase()} readings yet — log a couple in Vitals to see a trend.`
                  : "Log at least two readings to chart a trend."}
              </p>
            ) : (
              <TrendChart points={points} unit={meta.unit} range={range} />
            )}
          </CardContent>
        </Card>
      )}

      {profile && points.length > 0 && (
        <SummaryCard summary={summary} unit={meta.unit} label={meta.label} hasRange={!!range} />
      )}

      <p className="text-xs text-muted-foreground">
        Reference ranges are general adult guidance, shown for context only — not a diagnosis or
        medical advice.
      </p>
    </div>
  );
}

function TrendChart({
  points,
  unit,
  range,
}: {
  points: TrendPoint[];
  unit: string;
  range: ReturnType<typeof referenceRange>;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
          <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} width={36} />
          <Tooltip
            formatter={(v: number) => [`${v} ${unit}`, ""]}
            labelClassName="text-xs"
            contentStyle={{ fontSize: 12 }}
          />
          {range && (
            <ReferenceArea
              y1={range.low}
              y2={range.high}
              fill="hsl(var(--primary))"
              fillOpacity={0.08}
              ifOverflow="extendDomain"
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const FLAG_STYLE: Record<RangeFlag, string> = {
  in: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  below: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  above: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  unknown: "bg-secondary text-muted-foreground",
};
const FLAG_LABEL: Record<RangeFlag, string> = {
  in: "In range",
  below: "Below range",
  above: "Above range",
  unknown: "No range",
};

function SummaryCard({
  summary,
  unit,
  label,
  hasRange,
}: {
  summary: TrendSummary;
  unit: string;
  label: string;
  hasRange: boolean;
}) {
  const TrendIcon =
    summary.direction === "rising" ? TrendingUp : summary.direction === "falling" ? TrendingDown : Minus;
  const sentimentClass =
    summary.sentiment === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : summary.sentiment === "bad"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Summary</CardTitle>
        <CardDescription>
          {label} across {summary.count} reading{summary.count === 1 ? "" : "s"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Latest">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">
              {summary.current}
              <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
            </span>
            {hasRange && (
              <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", FLAG_STYLE[summary.latestFlag])}>
                {FLAG_LABEL[summary.latestFlag]}
              </span>
            )}
          </div>
        </Stat>
        <Stat label="Trend">
          <span className={cn("flex items-center gap-1 text-sm font-medium", sentimentClass)}>
            <TrendIcon className="h-4 w-4" />
            {summary.delta == null
              ? "—"
              : `${summary.delta > 0 ? "+" : ""}${round(summary.delta)} ${unit}`}
          </span>
        </Stat>
        <Stat label="Lowest">
          <span className="text-sm font-medium">
            {summary.min} {unit}
          </span>
        </Stat>
        <Stat label="Highest">
          <span className="text-sm font-medium">
            {summary.max} {unit}
          </span>
        </Stat>
      </CardContent>
    </Card>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

/** Trim floating-point noise from a delta for display. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
