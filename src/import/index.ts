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
  extractInsurance,
  normalizeDate,
  type InsuranceExtraction,
  type InsurancePolicy,
  type MemberField,
  type InsuranceRelationship,
} from "./extractInsurance";
export { matchInsurer, INSURERS, type Insurer, type InsurerMatch } from "./insurerVocab";
export { recognizeDocument, captureKindForMime, type Capture } from "./capture";
export { reconcileMembers, type MemberProposal } from "./memberReconcile";
// The domain-agnostic reading engine now lives in @scandoc/core; re-export the pieces
// myHealth's pages/tests consume so the `import/` surface is unchanged for callers.
export {
  tierByConfidence,
  requiresConfirmation,
  AUTO_THRESHOLD,
  DISAMBIGUATE_THRESHOLD,
  similarity,
  levenshtein,
  rankMatches,
  collapseWhitespace,
  splitLines,
  normalizeToken,
  digitsFromOcr,
  parseOcrNumber,
  stripLineMarker,
  stripFormPrefix,
  canonicalForm,
  type ConfidenceTier,
  type FieldSource,
} from "@scandoc/core";
export { matchDrug, parseStrength, normalizeFrequency, FORMULARY, type DrugMatch } from "./formulary";
export { matchTest, LAB_TESTS, type TestMatch } from "./labVocab";

import { extractPrescription, type PrescriptionExtraction } from "./extractPrescription";
import { extractLab, type LabExtraction } from "./extractLab";
import { extractInsurance, type InsuranceExtraction } from "./extractInsurance";
import type { FieldSource } from "@scandoc/core";

/** Document kinds the field extractor can structure. */
export type ParseKind = "prescription" | "lab_report" | "insurance";

export type ParsedDocument =
  | ({ kind: "prescription" } & PrescriptionExtraction)
  | ({ kind: "lab_report" } & LabExtraction)
  | ({ kind: "insurance" } & InsuranceExtraction);

/**
 * Route recognized text to the right extractor by document type. A thin
 * convenience over the extractors so callers (the review UI) have one entry point
 * keyed off the user-chosen document type.
 */
export function parseDocument(
  kind: ParseKind,
  text: string,
  opts: { source?: FieldSource } = {},
): ParsedDocument {
  switch (kind) {
    case "prescription":
      return { kind, ...extractPrescription(text, opts) };
    case "lab_report":
      return { kind, ...extractLab(text, opts) };
    case "insurance":
      return { kind, ...extractInsurance(text, opts) };
  }
}
