/**
 * Document import — deterministic field extraction.
 *
 * SCOPE: this module is the pure, testable *field-extraction* layer of the parser
 * (architecture doc §6.6–6.9): recognized text → structured, confidence-tiered,
 * human-confirmable fields. The upstream capture/normalization/OCR sidecar
 * (§6.1–6.5) is Phase 2 and intentionally NOT implemented here — extraction is
 * decoupled from recognition so it can be tested against difficult text fixtures
 * today, and wired to a real OCR source later without changing this contract.
 *
 * Everything here is pure: no DB, no network, no models, no LLM, no medical
 * interpretation. Safety-critical fields are confirm-required (`verified: false`).
 */
export { extractPrescription, type DrugField, type PrescriptionExtraction } from "./extractPrescription";
export { extractLab, type LabField, type LabExtraction, type LabFlag } from "./extractLab";
export {
  tierByConfidence,
  requiresConfirmation,
  AUTO_THRESHOLD,
  DISAMBIGUATE_THRESHOLD,
  type ConfidenceTier,
  type FieldSource,
} from "./confidence";
export { matchDrug, parseStrength, normalizeFrequency, FORMULARY, type DrugMatch } from "./formulary";
export { matchTest, LAB_TESTS, type TestMatch } from "./labVocab";
export { similarity, levenshtein, rankMatches } from "./fuzzy";
export * from "./normalize";

import { extractPrescription, type PrescriptionExtraction } from "./extractPrescription";
import { extractLab, type LabExtraction } from "./extractLab";
import type { FieldSource } from "./confidence";

export type ParsedDocument =
  | ({ kind: "prescription" } & PrescriptionExtraction)
  | ({ kind: "lab_report" } & LabExtraction);

/**
 * Route recognized text to the right extractor by document type. A thin
 * convenience over the two extractors so callers (the future review UI) have one
 * entry point keyed off the user-chosen document type.
 */
export function parseDocument(
  kind: "prescription" | "lab_report",
  text: string,
  opts: { source?: FieldSource } = {},
): ParsedDocument {
  return kind === "prescription"
    ? { kind, ...extractPrescription(text, opts) }
    : { kind, ...extractLab(text, opts) };
}
