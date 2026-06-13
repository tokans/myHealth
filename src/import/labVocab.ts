/**
 * Lab/pathology vocabulary for report extraction (architecture doc §4.1, §6.6).
 * Maps the many per-lab spellings of a test ("Haemoglobin" / "Hb" / "HGB") to one
 * canonical name + a LOINC-style code + the usual unit. Reference ranges are
 * usually printed on the report itself (we parse them), so the typical range here
 * is only a fallback hint, never authority. Representative starter set, not complete.
 */
import { normalizeToken, rankMatches, type RankedMatch } from "@scandoc/core";

export interface LabTest {
  canonical: string;
  /** LOINC code (illustrative). */
  loinc: string;
  unit: string;
  synonyms: string[];
}

export const LAB_TESTS: LabTest[] = [
  { canonical: "Hemoglobin", loinc: "718-7", unit: "g/dL", synonyms: ["haemoglobin", "hb", "hgb"] },
  { canonical: "Hematocrit", loinc: "4544-3", unit: "%", synonyms: ["haematocrit", "hct", "pcv"] },
  { canonical: "WBC Count", loinc: "6690-2", unit: "10^3/uL", synonyms: ["wbc", "tlc", "total leucocyte count", "leucocytes"] },
  { canonical: "Platelet Count", loinc: "777-3", unit: "10^3/uL", synonyms: ["platelets", "plt", "platelet"] },
  { canonical: "RBC Count", loinc: "789-8", unit: "10^6/uL", synonyms: ["rbc", "red blood cells"] },
  { canonical: "Fasting Glucose", loinc: "1558-6", unit: "mg/dL", synonyms: ["fbs", "fasting blood sugar", "glucose fasting", "fasting plasma glucose"] },
  { canonical: "HbA1c", loinc: "4548-4", unit: "%", synonyms: ["a1c", "glycated haemoglobin", "glycosylated hemoglobin", "hba1c"] },
  { canonical: "Total Cholesterol", loinc: "2093-3", unit: "mg/dL", synonyms: ["cholesterol total", "chol", "total chol"] },
  { canonical: "HDL Cholesterol", loinc: "2085-9", unit: "mg/dL", synonyms: ["hdl", "hdl-c", "hdl cholesterol"] },
  { canonical: "LDL Cholesterol", loinc: "2089-1", unit: "mg/dL", synonyms: ["ldl", "ldl-c", "ldl cholesterol"] },
  { canonical: "Triglycerides", loinc: "2571-8", unit: "mg/dL", synonyms: ["tg", "trig", "triglyceride"] },
  { canonical: "Serum Creatinine", loinc: "2160-0", unit: "mg/dL", synonyms: ["creatinine", "creat", "s. creatinine"] },
  { canonical: "Blood Urea", loinc: "3094-0", unit: "mg/dL", synonyms: ["urea", "bun", "blood urea nitrogen"] },
  { canonical: "TSH", loinc: "3016-3", unit: "uIU/mL", synonyms: ["thyroid stimulating hormone", "tsh ultrasensitive", "s. tsh"] },
  { canonical: "Vitamin D", loinc: "1989-3", unit: "ng/mL", synonyms: ["25-oh vitamin d", "vit d", "25 hydroxy vitamin d"] },
  { canonical: "Vitamin B12", loinc: "2132-9", unit: "pg/mL", synonyms: ["b12", "cobalamin", "vit b12"] },
  { canonical: "SGPT (ALT)", loinc: "1742-6", unit: "U/L", synonyms: ["alt", "sgpt", "alanine aminotransferase"] },
  { canonical: "SGOT (AST)", loinc: "1920-8", unit: "U/L", synonyms: ["ast", "sgot", "aspartate aminotransferase"] },
];

export interface TestMatch {
  canonical: string;
  loinc: string;
  unit: string;
  score: number;
  candidates: { canonical: string; loinc: string; score: number }[];
}

function aliasesOf(t: LabTest): string[] {
  return [normalizeToken(t.canonical), ...t.synonyms.map(normalizeToken)];
}

/** Fuzzy-match a recognized test name to the vocabulary. Null if nothing is close. */
export function matchTest(raw: string, opts: { minScore?: number; limit?: number } = {}): TestMatch | null {
  const q = normalizeToken(raw);
  if (!q) return null;
  const { minScore = 0.5, limit = 4 } = opts;
  const ranked: RankedMatch<LabTest>[] = rankMatches(q, LAB_TESTS, aliasesOf, { minScore, limit });
  if (ranked.length === 0) return null;
  const toCandidate = (r: RankedMatch<LabTest>) => ({
    canonical: r.item.canonical,
    loinc: r.item.loinc,
    score: r.score,
  });
  const top = ranked[0];
  return {
    canonical: top.item.canonical,
    loinc: top.item.loinc,
    unit: top.item.unit,
    score: top.score,
    candidates: ranked.map(toCandidate),
  };
}
