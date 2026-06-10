/**
 * Prescription field extraction (architecture doc §6.6, §6.9). Takes recognized
 * text (native-text or OCR — that upstream stage is the Phase-2 sidecar) and
 * proposes one structured row per medication line, each fuzzy-matched against the
 * formulary and carrying a confidence + review tier + provenance.
 *
 * It EXTRACTS and PROPOSES only — drug name and dosage are confirm-required
 * (`verified: false`) so the human-in-the-loop, not the machine, is the authority
 * for safety-critical fields. No medical interpretation.
 */
import { splitLines, stripLineMarker, stripFormPrefix } from "./normalize";
import { matchDrug, parseStrength, normalizeFrequency, FREQUENCY_MAP } from "./formulary";
import { tierByConfidence, requiresConfirmation, type ConfidenceTier, type FieldSource } from "./confidence";

export interface DrugField {
  /** The original line as recognized. */
  raw: string;
  /** The substring we treated as the drug name. */
  rawName: string;
  /** Canonical generic, or null when nothing in the formulary was close enough. */
  drug: string | null;
  /** Brand the read matched via (when matched on a brand alias). */
  brand: string | null;
  strength: string | null;
  form: string | null;
  /** Canonical frequency phrase ("twice daily"). */
  frequency: string | null;
  /** The raw frequency token as recognized ("BD", "1-0-1"). */
  frequencyRaw: string | null;
  duration: string | null;
  instructions: string | null;
  /** 0..1 — the drug-name match confidence. */
  confidence: number;
  tier: ConfidenceTier;
  source: FieldSource;
  /** Drug + dosage need human confirmation unless from native text. */
  confirmRequired: boolean;
  /** Machine output is never pre-verified; the review UI flips this. */
  verified: boolean;
  /** Ranked alternates for the disambiguation UI. */
  candidates: { generic: string; brand: string | null; score: number }[];
}

export interface PrescriptionExtraction {
  source: FieldSource;
  items: DrugField[];
}

const DURATION_RE = /\b(?:x|for)\s*(\d+)\s*(day|days|week|weeks|month|months|d|w|m)\b|\b(\d+)\s*\/\s*7\b/i;
const INSTRUCTIONS_RE = /\b(after food|before food|after meals|before meals|with water|empty stomach|at night|in the morning)\b/i;

const FREQ_TOKEN_RE = new RegExp(
  `\\b(${Object.keys(FREQUENCY_MAP).join("|")})\\b|([0-9OoIl]\\s*[-–/]\\s*[0-9OoIl]\\s*[-–/]\\s*[0-9OoIl])`,
  "i",
);

/** Lowest defined index, or `fallback` when all are null. */
function firstIndex(indices: (number | null)[], fallback: number): number {
  const defined = indices.filter((i): i is number => i != null && i >= 0);
  return defined.length ? Math.min(...defined) : fallback;
}

function extractLine(raw: string, source: FieldSource): DrugField | null {
  const marked = stripLineMarker(raw);
  const { rest, form } = stripFormPrefix(marked);
  if (!rest) return null;

  const strengthMatch = rest.match(parseStrengthRe());
  const strength = strengthMatch ? parseStrength(strengthMatch[0]) : null;

  const freqMatch = rest.match(FREQ_TOKEN_RE);
  const frequencyRaw = freqMatch ? freqMatch[0].trim() : null;
  const frequency = frequencyRaw ? normalizeFrequency(frequencyRaw) : null;

  const durMatch = rest.match(DURATION_RE);
  const duration = durMatch ? normalizeDuration(durMatch) : null;

  const instrMatch = rest.match(INSTRUCTIONS_RE);
  const instructions = instrMatch ? instrMatch[1].toLowerCase() : null;

  // The drug name is whatever precedes the first of strength / frequency / duration.
  const nameEnd = firstIndex(
    [strengthMatch?.index ?? null, freqMatch?.index ?? null, durMatch?.index ?? null],
    rest.length,
  );
  const rawName = rest.slice(0, nameEnd).replace(/[^A-Za-z0-9+/ -]+$/g, "").trim();
  if (!rawName) return null;

  const match = matchDrug(rawName);
  const confidence = match?.score ?? 0;

  // Keep-gate: a real medication line carries at least one drug/dosage signal.
  // Without any, this is header/footer/patient text — skip it rather than emit a
  // junk low-confidence row. (A formulary miss WITH a strength/frequency/form is
  // still kept — that's exactly the manual-entry case.)
  if (!match && !strength && !frequency && !form) return null;

  return {
    raw,
    rawName,
    drug: match?.generic ?? null,
    brand: match?.brand ?? null,
    strength: strength?.text ?? null,
    form,
    frequency,
    frequencyRaw: frequency ? frequencyRaw : null,
    duration,
    instructions,
    confidence,
    tier: tierByConfidence(confidence),
    source,
    confirmRequired: requiresConfirmation("drug", source) || requiresConfirmation("dosage", source),
    verified: false,
    candidates: match?.candidates ?? [],
  };
}

/**
 * Extract a prescription's medications from recognized text. Lines that yield no
 * usable name are skipped. `source` defaults to "ocr" (the safety-conservative
 * assumption); pass "native-text" when the text came straight from a text PDF.
 */
export function extractPrescription(text: string, opts: { source?: FieldSource } = {}): PrescriptionExtraction {
  const source = opts.source ?? "ocr";
  const items: DrugField[] = [];
  for (const line of splitLines(text)) {
    const field = extractLine(line, source);
    if (field) items.push(field);
  }
  return { source, items };
}

// A fresh regex per call — RegExp with the global-ish state is avoided by not reusing.
function parseStrengthRe(): RegExp {
  return /([0-9OoIlSBZg][0-9OoIlSBZg.,]*)\s*(mg|mcg|µg|ug|g|ml|iu|units?)\b/i;
}

function normalizeDuration(m: RegExpMatchArray): string {
  if (m[3]) return `${m[3]} days`; // the "5/7" form
  const n = m[1];
  const unitRaw = (m[2] || "").toLowerCase();
  const unit = unitRaw.startsWith("w")
    ? "weeks"
    : unitRaw.startsWith("m")
      ? "months"
      : "days";
  return `${n} ${unit}`;
}
