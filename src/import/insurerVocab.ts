/**
 * Health-insurer vocabulary for insurance-card extraction (architecture doc §4.1, §6.6).
 * Maps the many printed spellings of an insurer ("Star Health" / "Star Health & Allied
 * Insurance" / "STAR HEALTH") to one canonical name. India-context representative
 * starter set — not complete, additive over time. Used only to *propose* a cleaner
 * provider label; the user can always override it (no authority).
 */
import { normalizeToken, rankMatches, type RankedMatch } from "@scandoc/core";

export interface Insurer {
  canonical: string;
  synonyms: string[];
}

/** Representative India-context health insurers + TPAs. */
export const INSURERS: Insurer[] = [
  { canonical: "Star Health & Allied Insurance", synonyms: ["star health", "star health insurance", "star"] },
  { canonical: "HDFC ERGO Health Insurance", synonyms: ["hdfc ergo", "apollo munich", "hdfc ergo health"] },
  { canonical: "ICICI Lombard", synonyms: ["icici lombard", "icici lombard general insurance"] },
  { canonical: "Niva Bupa Health Insurance", synonyms: ["niva bupa", "max bupa"] },
  { canonical: "Care Health Insurance", synonyms: ["care health", "religare health", "religare"] },
  { canonical: "New India Assurance", synonyms: ["new india assurance", "the new india assurance"] },
  { canonical: "National Insurance", synonyms: ["national insurance", "national insurance company"] },
  { canonical: "Oriental Insurance", synonyms: ["oriental insurance", "the oriental insurance"] },
  { canonical: "United India Insurance", synonyms: ["united india", "united india insurance"] },
  { canonical: "Bajaj Allianz", synonyms: ["bajaj allianz", "bajaj allianz general insurance"] },
  { canonical: "Tata AIG", synonyms: ["tata aig", "tata aig general insurance"] },
  { canonical: "Aditya Birla Health Insurance", synonyms: ["aditya birla health", "aditya birla", "activ health"] },
  { canonical: "Manipal Cigna Health Insurance", synonyms: ["manipal cigna", "cigna ttk"] },
  { canonical: "LIC", synonyms: ["life insurance corporation", "lic of india"] },
];

export interface InsurerMatch {
  canonical: string;
  score: number;
  candidates: { canonical: string; score: number }[];
}

function aliasesOf(i: Insurer): string[] {
  return [normalizeToken(i.canonical), ...i.synonyms.map(normalizeToken)];
}

/** Fuzzy-match a recognized insurer name to the vocabulary. Null if nothing is close. */
export function matchInsurer(raw: string, opts: { minScore?: number; limit?: number } = {}): InsurerMatch | null {
  const q = normalizeToken(raw);
  if (!q) return null;
  const { minScore = 0.5, limit = 4 } = opts;
  const ranked: RankedMatch<Insurer>[] = rankMatches(q, INSURERS, aliasesOf, { minScore, limit });
  if (ranked.length === 0) return null;
  const top = ranked[0];
  return {
    canonical: top.item.canonical,
    score: top.score,
    candidates: ranked.map((r) => ({ canonical: r.item.canonical, score: r.score })),
  };
}
