/**
 * Medical-insurance-card field extraction (architecture doc §6.6, §6.9). Takes
 * recognized text (native-text or OCR — that upstream stage is the Phase-2 sidecar)
 * and proposes the policy-level fields plus one structured row per covered member,
 * each carrying a confidence + review tier + provenance.
 *
 * It EXTRACTS and PROPOSES only. Members are confirm-required (`verified: false`):
 * creating a person record is consequential, so the human-in-the-loop — not the
 * machine — decides which members to add. No medical interpretation.
 *
 * Pure: no DB, no network, no models, no LLM.
 */
import {
  splitLines,
  stripLineMarker,
  collapseWhitespace,
  digitsFromOcr,
  tierByConfidence,
  type ConfidenceTier,
  type FieldSource,
} from "@scandoc/core";
import { matchInsurer } from "./insurerVocab";

/** Relationship as mapped onto the common `relationship` master (or "self"/null). */
export type InsuranceRelationship =
  | "self"
  | "Spouse"
  | "Child"
  | "Parent"
  | "Sibling"
  | "Grandparent"
  | null;

export interface InsurancePolicy {
  /** Canonical insurer name when matched to the vocabulary, else the raw read. */
  insurer: string | null;
  /** The substring we treated as the insurer name. */
  insurerRaw: string | null;
  planName: string | null;
  policyNumber: string | null;
  groupNumber: string | null;
  /** ISO (yyyy-mm-dd) when parseable, else null. */
  validFrom: string | null;
  validThrough: string | null;
  /** Ranked alternates for an insurer disambiguation UI. */
  insurerCandidates: { canonical: string; score: number }[];
}

export interface MemberField {
  /** The original line as recognized. */
  raw: string;
  /** Proposed display name (null when nothing name-like was found). */
  name: string | null;
  /** Mapped relationship-to-self ("self" for the primary/proposer), or null. */
  relationship: InsuranceRelationship;
  /** The raw relationship token as printed ("SON", "PRIMARY"). */
  relationshipRaw: string | null;
  /** ISO (yyyy-mm-dd) when parseable, else null. */
  dob: string | null;
  /** Member / UHID number as printed (uppercased, OCR not over-corrected). */
  memberId: string | null;
  /** True when this is the primary/proposer (relationship === "self"). */
  isSelf: boolean;
  /** 0..1 — extraction confidence for this member row. */
  confidence: number;
  tier: ConfidenceTier;
  source: FieldSource;
  /** Always true — adding a person is user-confirmed regardless of source. */
  confirmRequired: boolean;
  /** Machine output is never pre-verified; the review UI flips this. */
  verified: boolean;
}

export interface InsuranceExtraction {
  source: FieldSource;
  policy: InsurancePolicy;
  members: MemberField[];
}

/** Card relationship terms → the app's relationship value (or "self"). */
const RELATIONSHIP_TERMS: { re: RegExp; value: InsuranceRelationship }[] = [
  { re: /\b(self|primary|proposer|subscriber|principal|insured|policy\s*holder|policyholder|employee|holder)\b/i, value: "self" },
  { re: /\b(spouse|husband|wife|partner)\b/i, value: "Spouse" },
  { re: /\b(son|daughter|child|dependent\s*child|kid|baby)\b/i, value: "Child" },
  { re: /\b(father|mother|parent|dad|mom|mum)\b/i, value: "Parent" },
  { re: /\b(brother|sister|sibling)\b/i, value: "Sibling" },
  { re: /\b(grand\s*father|grand\s*mother|grand\s*parent|grandfather|grandmother|grandparent)\b/i, value: "Grandparent" },
];

const POLICY_NO_RE = /\bpolicy\s*(?:no\.?|number|num|#|id)\s*[:#\-]?\s*([A-Za-z0-9OoIlSB][A-Za-z0-9OoIlSB\/\- ]{3,})/i;
const GROUP_RE = /\bgroup\s*(?:no\.?|number|id|#)?\s*[:#\-]?\s*([A-Za-z0-9OoIlSB][A-Za-z0-9OoIlSB\/\-]{2,})/i;
const VALID_THROUGH_RE = /\b(?:valid\s*(?:up\s*to|upto|till|through|until|to)|expiry|expires?|expiry\s*date)\s*[:#\-]?\s*([0-9OoIlSB][0-9OoIlSB\/.\- ]{6,})/i;
const VALID_FROM_RE = /\b(?:valid\s*from|issue\s*date|issued|effective(?:\s*date)?|w\.?e\.?f\.?|date\s*of\s*issue)\s*[:#\-]?\s*([0-9OoIlSB][0-9OoIlSB\/.\- ]{6,})/i;
const PLAN_RE = /\b(?:plan|product|policy\s*type|scheme|cover)\s*(?:name)?\s*[:#\-]\s*(.+)$/i;
const INSURER_LABEL_RE = /\b(?:insurer|insurance\s*company|company|underwritten\s*by|issued\s*by)\s*[:#\-]\s*(.+)$/i;
const MEMBER_ID_RE = /\b(?:member\s*id|membership\s*(?:no\.?|id)|uhid|emp\s*id|id\s*no\.?|id)\s*[:#\-]?\s*([A-Za-z0-9OoIlSB][A-Za-z0-9OoIlSB\/\-]{3,})/i;
const DATE_RE = /\b([0-9OoIlSB]{1,4})\s*[\/.\-]\s*([0-9OoIlSB]{1,2})\s*[\/.\-]\s*([0-9OoIlSB]{2,4})\b/;
const DOB_LABEL_RE = /\b(?:dob|d\.o\.b\.?|date\s*of\s*birth|born)\b/i;

/** Strip OCR letter↔digit confusion from a digit run, then keep only digits. */
function ocrDigits(s: string): string {
  return digitsFromOcr(s).replace(/\D/g, "");
}

/**
 * Normalize a printed date to ISO (yyyy-mm-dd). India cards are day-first; a 4-digit
 * first group is treated as yyyy-mm-dd. Returns null when not confidently parseable.
 */
export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(DATE_RE);
  if (!m) return null;
  const a = ocrDigits(m[1]);
  const b = ocrDigits(m[2]);
  const c = ocrDigits(m[3]);
  if (!a || !b || !c) return null;
  let y: string, mo: string, d: string;
  if (a.length === 4) {
    // yyyy-mm-dd
    y = a; mo = b.padStart(2, "0"); d = c.padStart(2, "0");
  } else {
    // dd-mm-yyyy (day-first); a 2-digit year is windowed to 19xx/20xx.
    d = a.padStart(2, "0"); mo = b.padStart(2, "0");
    y = c.length === 2 ? (Number(c) > 30 ? `19${c}` : `20${c}`) : c.padStart(4, "0");
  }
  const dn = Number(d), mn = Number(mo), yn = Number(y);
  if (mn < 1 || mn > 12 || dn < 1 || dn > 31 || yn < 1900 || yn > 2100) return null;
  return `${y}-${mo}-${d}`;
}

/** Title-case a recognized name and trim trailing punctuation/separators. */
function cleanName(s: string): string {
  return collapseWhitespace(s)
    .replace(/[^A-Za-z .'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length > 1 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toUpperCase()))
    .join(" ");
}

function matchRelationship(text: string): { value: InsuranceRelationship; raw: string } | null {
  for (const { re, value } of RELATIONSHIP_TERMS) {
    const m = text.match(re);
    if (m) return { value, raw: m[1].toUpperCase() };
  }
  return null;
}

/** Lowest defined index, or `fallback` when all are null/absent. */
function firstIndex(indices: (number | null | undefined)[], fallback: number): number {
  const defined = indices.filter((i): i is number => i != null && i >= 0);
  return defined.length ? Math.min(...defined) : fallback;
}

/**
 * Try to read one covered-member row. Returns null when the line carries no member
 * signal (it's a header/policy/footer line). A member line needs a name AND at least
 * one of: a relationship token, a member id, or a date of birth.
 */
function extractMemberLine(raw: string, source: FieldSource): MemberField | null {
  const line = collapseWhitespace(stripLineMarker(raw));
  if (!line) return null;

  const rel = matchRelationship(line);
  const idMatch = line.match(MEMBER_ID_RE);
  const memberId = idMatch ? idMatch[1].replace(/\s+/g, "").toUpperCase() : null;

  // DOB: a labeled date wins; otherwise the first plausible date on the line.
  const dobLabel = line.match(DOB_LABEL_RE);
  let dob: string | null = null;
  let dateIndex: number | null = null;
  const dateMatch = line.match(DATE_RE);
  if (dateMatch) {
    dob = normalizeDate(dateMatch[0]);
    dateIndex = dateMatch.index ?? null;
  }

  // The name is whatever precedes the first of relationship / id / dob-label / date /
  // a "(" — the common "Name (Relationship)" layout.
  const parenIdx = line.indexOf("(");
  const nameEnd = firstIndex(
    [
      rel ? line.search(RELATIONSHIP_TERMS.find((t) => t.value === rel.value)!.re) : null,
      idMatch?.index ?? null,
      dobLabel?.index ?? null,
      dateIndex,
      parenIdx >= 0 ? parenIdx : null,
    ],
    line.length,
  );
  const name = cleanName(line.slice(0, nameEnd)) || null;

  // Keep-gate: a real member row has a name plus a relationship or a member id.
  // A bare date alone is NOT enough — that's how policy lines like "Valid upto: …"
  // sneak in — so dob only sharpens confidence, it never qualifies a row.
  if (!name || name.length < 2) return null;
  if (!rel && !memberId) return null;

  // Confidence: name + a recognized relationship is the strong case.
  let confidence = 0.5; // a plausible name
  if (rel) confidence += 0.4;
  if (memberId || dob) confidence += 0.1;
  confidence = Math.min(1, confidence);

  return {
    raw,
    name,
    relationship: rel?.value ?? null,
    relationshipRaw: rel?.raw ?? null,
    dob,
    memberId,
    isSelf: rel?.value === "self",
    confidence,
    tier: tierByConfidence(confidence),
    source,
    confirmRequired: true,
    verified: false,
  };
}

function extractPolicy(lines: string[], source: FieldSource): InsurancePolicy {
  void source;
  const policy: InsurancePolicy = {
    insurer: null,
    insurerRaw: null,
    planName: null,
    policyNumber: null,
    groupNumber: null,
    validFrom: null,
    validThrough: null,
    insurerCandidates: [],
  };

  let bestInsurer: { canonical: string; score: number; raw: string } | null = null;

  for (const line of lines) {
    if (!policy.policyNumber) {
      const m = line.match(POLICY_NO_RE);
      if (m) policy.policyNumber = m[1].trim().replace(/\s+/g, "").toUpperCase();
    }
    if (!policy.groupNumber) {
      const m = line.match(GROUP_RE);
      if (m) policy.groupNumber = m[1].trim().replace(/\s+/g, "").toUpperCase();
    }
    if (!policy.validThrough) {
      const m = line.match(VALID_THROUGH_RE);
      if (m) policy.validThrough = normalizeDate(m[1]);
    }
    if (!policy.validFrom) {
      const m = line.match(VALID_FROM_RE);
      if (m) policy.validFrom = normalizeDate(m[1]);
    }
    if (!policy.planName) {
      const m = line.match(PLAN_RE);
      if (m) policy.planName = collapseWhitespace(m[1]).slice(0, 80);
    }

    // Insurer: a labeled line is authoritative; otherwise fuzzy-match any header line.
    const labelled = line.match(INSURER_LABEL_RE);
    const candidateText = labelled ? labelled[1] : line;
    const im = matchInsurer(candidateText);
    if (im) {
      // A labeled match is strong (floor its score); otherwise keep the best fuzzy hit.
      const score = labelled ? Math.max(im.score, 0.9) : im.score;
      if (!bestInsurer || score > bestInsurer.score) {
        bestInsurer = { canonical: im.canonical, score, raw: collapseWhitespace(candidateText) };
        policy.insurerCandidates = im.candidates;
      }
    }
  }

  if (bestInsurer) {
    policy.insurer = bestInsurer.canonical;
    policy.insurerRaw = bestInsurer.raw;
  }
  return policy;
}

/**
 * Extract an insurance card's policy fields + covered members from recognized text.
 * `source` defaults to "ocr" (the safety-conservative assumption); pass "native-text"
 * when the text came straight from a text PDF.
 */
export function extractInsurance(text: string, opts: { source?: FieldSource } = {}): InsuranceExtraction {
  const source = opts.source ?? "ocr";
  const lines = splitLines(text);
  const policy = extractPolicy(lines, source);
  const members: MemberField[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const member = extractMemberLine(line, source);
    if (!member || !member.name) continue;
    // Dedupe by (name + relationship) so a name echoed in a header isn't double-added.
    const key = `${member.name.toLowerCase()}|${member.relationship ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    members.push(member);
  }
  return { source, policy, members };
}
