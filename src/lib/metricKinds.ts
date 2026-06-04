/** Canonical metric kinds + their units, shared by Vitals and Goals. */
export interface MetricKind {
  kind: string;
  label: string;
  unit: string;
  /** Default goal direction when this metric is the goal target. */
  direction: "decrease" | "increase" | "maintain";
}

export const METRIC_KINDS: MetricKind[] = [
  { kind: "weight", label: "Weight", unit: "kg", direction: "decrease" },
  { kind: "bp_systolic", label: "Blood pressure (systolic)", unit: "mmHg", direction: "decrease" },
  { kind: "bp_diastolic", label: "Blood pressure (diastolic)", unit: "mmHg", direction: "decrease" },
  { kind: "glucose_fasting", label: "Fasting glucose", unit: "mg/dL", direction: "decrease" },
  { kind: "heart_rate", label: "Resting heart rate", unit: "bpm", direction: "decrease" },
  { kind: "spo2", label: "SpO₂", unit: "%", direction: "increase" },
  { kind: "temperature", label: "Temperature", unit: "°C", direction: "maintain" },
  { kind: "steps", label: "Steps / day", unit: "steps", direction: "increase" },
];

export function metricKind(kind: string): MetricKind | undefined {
  return METRIC_KINDS.find((m) => m.kind === kind);
}
