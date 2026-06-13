/**
 * Domain vocabularies for prescription extraction (architecture doc §6.6): a small
 * India-context drug formulary (brand → generic), dosage-frequency abbreviations,
 * and strength parsing. Constraining noisy reads against these is the single
 * highest-leverage accuracy mechanism — a bad character read snaps to a real drug.
 *
 * This is intentionally a representative starter set, NOT a complete formulary; the
 * shipped pipeline would load a licensed India formulary (open question in the doc).
 * Pure data + pure helpers — no DB, no models.
 */
import { normalizeToken, digitsFromOcr, rankMatches, type RankedMatch } from "@scandoc/core";

export interface DrugEntry {
  /** Canonical generic name (INN). */
  generic: string;
  /** Common India brand names that map to this generic. */
  brands: string[];
}

export const FORMULARY: DrugEntry[] = [
  { generic: "Paracetamol", brands: ["Crocin", "Dolo", "Calpol", "Metacin"] },
  { generic: "Metformin", brands: ["Glycomet", "Gluconorm", "Glyciphage"] },
  { generic: "Amlodipine", brands: ["Amlodac", "Amlong", "Stamlo"] },
  { generic: "Atorvastatin", brands: ["Atorva", "Storvas", "Lipikind"] },
  { generic: "Amoxicillin", brands: ["Mox", "Novamox"] },
  { generic: "Amoxicillin+Clavulanate", brands: ["Augmentin", "Clavam", "Moxikind-CV"] },
  { generic: "Azithromycin", brands: ["Azithral", "Azee", "Zithromax"] },
  { generic: "Pantoprazole", brands: ["Pantop", "Pan", "Pantocid"] },
  { generic: "Omeprazole", brands: ["Omez", "Ocid"] },
  { generic: "Cetirizine", brands: ["Cetzine", "Alerid", "Okacet"] },
  { generic: "Levothyroxine", brands: ["Thyronorm", "Eltroxin"] },
  { generic: "Losartan", brands: ["Losar", "Repace"] },
  { generic: "Telmisartan", brands: ["Telma", "Telmikind"] },
  { generic: "Metoprolol", brands: ["Metolar", "Betaloc"] },
  { generic: "Aspirin", brands: ["Ecosprin", "Disprin"] },
  { generic: "Clopidogrel", brands: ["Clopilet", "Deplatt"] },
  { generic: "Ibuprofen", brands: ["Brufen", "Combiflam"] },
  { generic: "Diclofenac", brands: ["Voveran", "Volini"] },
  { generic: "Glimepiride", brands: ["Amaryl", "Glimestar"] },
  { generic: "Insulin Glargine", brands: ["Lantus", "Basalog", "Glaritus"] },
  { generic: "Montelukast", brands: ["Montair", "Montek"] },
  { generic: "Rabeprazole", brands: ["Rabicip", "Razo"] },
  { generic: "Vitamin D3", brands: ["Calcirol", "Uprise-D3"] },
  { generic: "Vitamin B12", brands: ["Methylcobal", "Nurokind"] },
  { generic: "Ranitidine", brands: ["Rantac", "Aciloc"] },
];

export interface DrugMatch {
  /** Canonical generic. */
  generic: string;
  /** The brand the read matched via, if it matched a brand alias. */
  brand: string | null;
  /** 0..1 similarity of the best alias. */
  score: number;
  /** Top-N alternates (for the disambiguation UI). */
  candidates: { generic: string; brand: string | null; score: number }[];
}

function aliasesOf(d: DrugEntry): string[] {
  return [normalizeToken(d.generic), ...d.brands.map(normalizeToken)];
}

/** Fuzzy-match a recognized drug string to the formulary. Null if nothing is close. */
export function matchDrug(raw: string, opts: { minScore?: number; limit?: number } = {}): DrugMatch | null {
  const q = normalizeToken(raw);
  if (!q) return null;
  const { minScore = 0.5, limit = 4 } = opts;
  const ranked: RankedMatch<DrugEntry>[] = rankMatches(q, FORMULARY, aliasesOf, { minScore, limit });
  if (ranked.length === 0) return null;

  const toCandidate = (r: RankedMatch<DrugEntry>) => {
    const brand = r.item.brands.find((b) => normalizeToken(b) === r.via) ?? null;
    return { generic: r.item.generic, brand, score: r.score };
  };
  const top = toCandidate(ranked[0]);
  return { ...top, candidates: ranked.map(toCandidate) };
}

// ── Frequency ────────────────────────────────────────────────────────────────

/** Canonical, human-readable dosing frequencies. */
export const FREQUENCY_MAP: Record<string, string> = {
  od: "once daily",
  qd: "once daily",
  hs: "at bedtime",
  bd: "twice daily",
  bid: "twice daily",
  tds: "three times daily",
  tid: "three times daily",
  qid: "four times daily",
  qds: "four times daily",
  sos: "as needed",
  prn: "as needed",
  stat: "immediately",
  q4h: "every 4 hours",
  q6h: "every 6 hours",
  q8h: "every 8 hours",
  q12h: "every 12 hours",
};

/**
 * Resolve a frequency token to its canonical phrase. Handles the abbreviations
 * above and the India-style positional notation ("1-0-1" = morning-noon-night;
 * count of non-zero slots → times per day). Returns null if unrecognized.
 */
export function normalizeFrequency(token: string): string | null {
  const k = token.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (k in FREQUENCY_MAP) return FREQUENCY_MAP[k];

  // Positional "1-0-1" / "1-1-1" / "0-0-1" (allow OCR'd digits).
  const positional = token.match(/^\s*([0-9OoIl])\s*[-–/]\s*([0-9OoIl])\s*[-–/]\s*([0-9OoIl])\s*$/);
  if (positional) {
    const slots = positional.slice(1, 4).map((d) => Number(digitsFromOcr(d)));
    const perDay = slots.filter((n) => n > 0).length;
    const map: Record<number, string> = {
      1: "once daily",
      2: "twice daily",
      3: "three times daily",
    };
    return map[perDay] ?? null;
  }
  return null;
}

// ── Strength ─────────────────────────────────────────────────────────────────

export interface Strength {
  value: number;
  unit: string;
  /** Re-serialized canonical form, e.g. "500 mg". */
  text: string;
}

const STRENGTH_RE = /([0-9OoIlSBZg][0-9OoIlSBZg.,]*)\s*(mg|mcg|µg|ug|g|ml|iu|units?)\b/i;

/** Parse the first strength in a string ("5OO mg" → {500,"mg"}), OCR-tolerant. */
export function parseStrength(raw: string): Strength | null {
  const m = raw.match(STRENGTH_RE);
  if (!m) return null;
  const value = Number(digitsFromOcr(m[1]).replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  let unit = m[2].toLowerCase();
  if (unit === "µg" || unit === "ug") unit = "mcg";
  if (unit === "unit") unit = "units";
  return { value, unit, text: `${value} ${unit}` };
}
