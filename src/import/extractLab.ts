/**
 * Pathology/lab report extraction (architecture doc §4.1, §6.6, §6.9). Parses
 * recognized report lines into structured rows: canonical test (via the lab
 * vocabulary), numeric value, unit, reference range, and an abnormal flag — each
 * with a name-match confidence + review tier + provenance.
 *
 * Lab reports are machine-generated and tabular, so this is mostly deterministic
 * parsing. It records data; it never interprets it medically — the H/L flag is a
 * mechanical value-vs-range comparison, not advice.
 */
import { collapseWhitespace, parseOcrNumber } from "./normalize";
import { matchTest } from "./labVocab";
import { tierByConfidence, type ConfidenceTier, type FieldSource } from "./confidence";

export type LabFlag = "H" | "L" | "normal";

export interface LabField {
  raw: string;
  rawName: string;
  test: string | null;
  loinc: string | null;
  value: number | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  flag: LabFlag | null;
  /** 0..1 — the test-name match confidence. */
  confidence: number;
  tier: ConfidenceTier;
  source: FieldSource;
  candidates: { canonical: string; loinc: string; score: number }[];
}

export interface LabExtraction {
  source: FieldSource;
  items: LabField[];
}

/** Known unit spellings, longest-first so "mg/dL" wins over a bare token. */
const KNOWN_UNITS = [
  "10^3/uL", "10^6/uL", "x10^3/uL", "x10^6/uL",
  "uIU/mL", "mIU/mL", "ng/mL", "pg/mL", "mmol/L", "mEq/L",
  "mg/dL", "g/dL", "g/L", "U/L", "IU/L", "fL", "pg", "%",
].sort((a, b) => b.length - a.length);

// A numeric token allowing OCR letter↔digit confusion; must contain a real digit.
const NUM = "[0-9OoIlSBZg][0-9OoIlSBZg.,]*";
const RANGE_RE = new RegExp(`[(\\[]?\\s*(${NUM})\\s*(?:-|–|—|to)\\s*(${NUM})\\s*[)\\]]?`, "i");
const NUM_TOKEN_RE = new RegExp(NUM, "gi");

function hasRealDigit(s: string): boolean {
  return /[0-9]/.test(s);
}

function findUnit(line: string, fromIndex: number): string | null {
  let best: { unit: string; index: number } | null = null;
  for (const u of KNOWN_UNITS) {
    const idx = line.toLowerCase().indexOf(u.toLowerCase(), fromIndex);
    if (idx >= 0 && (best == null || idx < best.index)) best = { unit: u, index: idx };
  }
  return best?.unit ?? null;
}

function explicitFlag(line: string): LabFlag | null {
  if (/\(\s*H\s*\)|\bHIGH\b|\bH\s*$/i.test(line) && !/\bL\s*$/i.test(line)) return "H";
  if (/\(\s*L\s*\)|\bLOW\b|\bL\s*$/i.test(line)) return "L";
  return null;
}

function extractLine(raw: string, source: FieldSource): LabField | null {
  const line = collapseWhitespace(raw);
  if (!line) return null;

  // Reference range first, so its digits aren't mistaken for the value.
  const rangeMatch = line.match(RANGE_RE);
  const range =
    rangeMatch && hasRealDigit(rangeMatch[1]) && hasRealDigit(rangeMatch[2])
      ? { low: parseOcrNumber(rangeMatch[1]), high: parseOcrNumber(rangeMatch[2]), start: rangeMatch.index ?? -1 }
      : null;

  // The value is the first real-digit numeric token that isn't inside the range.
  let value: number | null = null;
  let valueIndex = -1;
  for (const m of line.matchAll(NUM_TOKEN_RE)) {
    const idx = m.index ?? -1;
    if (!hasRealDigit(m[0])) continue;
    // Skip digits embedded inside a name/unit token (HbA1c, B12, 10^3) — a real
    // value is delimited (start, space, colon, paren), never preceded by a letter.
    if (idx > 0 && /[A-Za-z]/.test(line[idx - 1])) continue;
    if (range && range.start >= 0 && idx >= range.start) continue;
    value = parseOcrNumber(m[0]);
    valueIndex = idx;
    break;
  }

  // Test name = text before the value (or before the range / first number).
  const cut = valueIndex >= 0 ? valueIndex : range?.start != null && range.start >= 0 ? range.start : line.length;
  const rawName = line.slice(0, cut).replace(/[:\-–\s]+$/g, "").replace(/^[\s:.-]+/, "").trim();
  if (!rawName) return null;

  const match = matchTest(rawName);
  if (!match) return null; // not a recognizable test line (header/footer/etc.)

  const unit = findUnit(line, valueIndex >= 0 ? valueIndex : 0) ?? match.unit;

  let flag: LabFlag | null = explicitFlag(line);
  if (flag == null && value != null && range && range.low != null && range.high != null) {
    flag = value < range.low ? "L" : value > range.high ? "H" : "normal";
  }

  return {
    raw,
    rawName,
    test: match.canonical,
    loinc: match.loinc,
    value,
    unit,
    refLow: range?.low ?? null,
    refHigh: range?.high ?? null,
    flag,
    confidence: match.score,
    tier: tierByConfidence(match.score),
    source,
    candidates: match.candidates,
  };
}

/**
 * Extract lab results from recognized report text. Lines that don't resolve to a
 * known test (titles, patient header, footnotes) are dropped. `source` defaults to
 * "ocr"; pass "native-text" for text PDFs.
 */
export function extractLab(text: string, opts: { source?: FieldSource } = {}): LabExtraction {
  const source = opts.source ?? "ocr";
  const items: LabField[] = [];
  for (const line of text.split(/\r?\n/)) {
    const field = extractLine(line, source);
    if (field) items.push(field);
  }
  return { source, items };
}
