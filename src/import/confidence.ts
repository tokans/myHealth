/**
 * Confidence tiering (architecture doc §6.7). A field is routed by *tier*, not a
 * single pass/fail threshold, so a human only reviews what actually needs it:
 *
 *   - auto         → high confidence, accept as-is (but see confirm-required below)
 *   - disambiguate → medium: show top-N real candidates + an "Other" escape hatch
 *   - manual       → low: dictionary-assisted manual entry
 *
 * Safety overlay: drug name and dosage are *confirm-required* regardless of tier
 * when not sourced from native text — `auto` never means "silently saved" for
 * those fields. Callers gate the save on `verified`.
 */

export type ConfidenceTier = "auto" | "disambiguate" | "manual";
export type FieldSource = "native-text" | "ocr" | "human";

/** ≥ this similarity auto-accepts. */
export const AUTO_THRESHOLD = 0.9;
/** ≥ this (and below auto) goes to disambiguation; below it is manual entry. */
export const DISAMBIGUATE_THRESHOLD = 0.6;

/** Map a 0..1 confidence to its review tier. Out-of-range input is clamped. */
export function tierByConfidence(confidence: number): ConfidenceTier {
  const c = Math.max(0, Math.min(1, confidence));
  if (c >= AUTO_THRESHOLD) return "auto";
  if (c >= DISAMBIGUATE_THRESHOLD) return "disambiguate";
  return "manual";
}

/** Safety-critical fields (drug, dosage) — confirm-required unless native text. */
export function requiresConfirmation(field: "drug" | "dosage" | "other", source: FieldSource): boolean {
  if (source === "human") return false;
  if (source === "native-text") return false;
  return field === "drug" || field === "dosage";
}
