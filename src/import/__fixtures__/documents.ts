/**
 * Difficult-to-parse document fixtures for the extraction tests.
 *
 * These simulate the *output of the recognition stage* (native-text or OCR) — the
 * thing the field extractor actually consumes — deliberately seeded with the
 * real-world failure modes from the architecture doc §4 & §6:
 *   - OCR letter↔digit confusion (O/0, l/I/1, S/5, B/8)
 *   - brand names that must resolve to a generic
 *   - clinical abbreviations (BD/TDS/OD/HS) and India-style positional dosing (1-0-1)
 *   - missing/odd units and strengths
 *   - en-dash vs hyphen reference ranges, parenthesized ranges, H/L flags
 *   - non-data noise (patient header, footer, signatory) that must be ignored
 *   - genuinely garbled (handwriting-like) lines that must NOT be auto-accepted
 *
 * Keep them as strings so the tests are pure and run anywhere (no file IO, no PDFs).
 */

// ── Prescriptions ──────────────────────────────────────────────────────────────

/** Clean, printed/EHR-style — the tractable baseline. */
export const RX_CLEAN = `
Dr. A. Mehta, MBBS MD — Reg. 12345
Patient: Asha D.   Date: 04/06/2026

1. Tab. Crocin 500mg BD x 5 days after food
2. Cap. Omez 20mg OD before food
3. Tab. Telma 40mg OD
`.trim();

/** Phone-photo OCR: character confusions + positional dosing + glare-dropped chars. */
export const RX_OCR_NOISY = `
Tab. CroÇin 5OO mg 1-0-1 after food
Cap 0mez 2O mg od bef food
Tab Te1ma 4O mg OD
Tab. Metf0rmin 5OO mg BD x 1O days
`.trim();

/** Strength present but no unit on a combo drug; multi-times-a-day abbreviation. */
export const RX_ABBREV = `
Tab Augmentin 625mg TDS x 7 days
Tab Dolo 650 1-1-1
Tab Pan 40 OD before food
`.trim();

/** A garbled, handwriting-like line that resolves to nothing in the formulary. */
export const RX_UNREADABLE = `
Tab Xyzqplmn 100mg OD
Tab. zzzzz 5mg HS
`.trim();

// ── Lab / pathology reports ─────────────────────────────────────────────────────

/** Clean tabular report with a mix of normal and flagged values. */
export const LAB_CLEAN = `
SUNRISE DIAGNOSTICS — COMPLETE BLOOD COUNT
Patient Name: Asha D        Age/Sex: 41/F
Sample Collected: 03/06/2026

Test                 Result    Unit        Reference
Hemoglobin           13.5      g/dL        13.0-17.0
WBC Count            7.2       10^3/uL     4.0-11.0
Platelet Count       250       10^3/uL     150-410

Authorized Signatory
`.trim();

/** Synonyms, OCR digit confusion, en-dash ranges, explicit + derived H/L flags. */
export const LAB_OCR_NOISY = `
LIPID PROFILE & METABOLIC
Hb : 9.2 g/dL (13.0 - 17.0) L
Fasting Glucose  11O mg/dL (70-100) H
HbA1c 6.8 % (4.0–6.0)
S. Creatinine l.2 mg/dL 0.6-1.2
Total Cholesterol 245 mg/dL  (<200)
TLC 7.2 10^3/uL 4.0-11.0
-- End of Report --
`.trim();

/** Value present, no printed range (range must come back null, flag unknown). */
export const LAB_NO_RANGE = `
TSH 3.4 uIU/mL
Vitamin D 18 ng/mL
`.trim();
