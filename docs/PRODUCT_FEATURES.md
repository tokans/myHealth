# myHealth — Product Features

**Status:** Living product document (v0.1 — pre-implementation)
**Independence:** myHealth is a **fully standalone** app — a user may install it without any other app. It belongs to a family of independent local-first apps (`myFinance` is another) that *optionally* share a common substrate package. myHealth does **not** depend on myFinance; the shared package is reusable infrastructure, not a sibling-app dependency. See [`SHARED_CORE.md`](./SHARED_CORE.md).
**Companion docs:** [`PLAN.md`](./PLAN.md) (architecture & delivery plan), [`SHARED_CORE.md`](./SHARED_CORE.md) (shared-package strategy), and [`medical-document-parser-architecture.md`](./medical-document-parser-architecture.md) (the document-import pipeline).

---

## 1. Vision

myHealth is a **private, offline, family health companion**. It lets a person build and maintain a structured health record for **themselves and their family members**, set and track **health goals**, and **import medical documents** (prescriptions and lab/pathology reports) so the data that today lives in a shoebox of PDFs and paper becomes searchable, trended, and ready to hand to a doctor.

It is the health-domain counterpart to myFinance: same "your data lives only on your device" promise, same client-only Tauri+React shell, same gated master-data + tier model, same encrypted vault for sensitive documents.

**One-line positioning:** *Your family's health record, kept by you, on your device — never in anyone's cloud.*

---

## 2. Core principles & constraints

These come from the medical-parser architecture doc and the shared local-first design ([`SHARED_CORE.md`](./SHARED_CORE.md)), and are **hard constraints**:

1. **Client-only, no backend, no web target.** All data lives on the user's device in local SQLite + an encrypted vault. There is no server that holds health data.
2. **Receive-only network.** The only outbound calls *pull* signed, public reference data (the professionals directory, the health-items catalog, master lists). The app **uploads nothing** and has no analytics / phone-home.
3. **No medical interpretation.** myHealth **extracts, records, trends, and reminds**. It does **not** diagnose, advise, check drug interactions, or provide clinical decision support. Every screen that could be mistaken for advice carries a disclaimer. (This mirrors the parser doc's explicit non-goal.)
4. **No cloud LLM; no LLM in product logic.** All goal math, trend flagging, screening schedules, and checklists are **deterministic**. The *only* permitted ML is small, **local, CPU** models used as an **OCR assist** in the import pipeline — and even there, output is **never authority**: safety-critical fields (drug name, dosage, lab value) require human confirmation when not read from native PDF text. (See parser doc §6.5, §6.7, §10.)
5. **Human-in-the-loop import.** The import pipeline proposes; a human confirms. Every correction is logged locally for later improvement. (Parser doc §6.8.)
6. **Privacy as a feature.** Local-only processing of medical documents is the headline compliance/privacy advantage, not an afterthought.
7. **Gated reference data.** Downloaded master content (professionals, items) is **invisible to the user until (a) they reach a usage tier AND (b) the owner has actually published that data**. No empty/teaser states leaking that a feature exists before there's data behind it.

---

## 3. Personas

- **The household record-keeper** — the primary user. Maintains profiles for spouse, children, and aging parents. Wants one place for everyone's reports, medications, and upcoming check-ups.
- **The goal-driven individual** — tracking weight, blood sugar, blood pressure, fitness, or recovery from a condition. Wants trends and reminders.
- **The caregiver** — managing a dependent's chronic condition: medications, lab schedules, appointments, emergency info.
- **The owner (you)** — curates and signs the master reference bundles (professionals, items) that get OTA-pushed to qualifying users.

---

## 4. Feature catalog

### 4.A Health Profiles — self & family members *(core)*
The backbone of the app — the analog of myFinance's **People** table.

- One profile per family member: name, relationship, date of birth, sex, blood group, height, photo (optional).
- **Medical baseline per profile:** allergies (drug/food/environmental, with reaction + severity), chronic conditions, current medications, past surgeries/hospitalizations, family history flags, lifestyle notes (smoker/diet/activity).
- **Identifiers & coverage:** health-insurance policies, government health IDs (e.g. ABHA), preferred hospital, primary physician (links to a professional record).
- **Emergency block:** ICE contacts, organ-donor status, advance-directive note, "in an emergency" free text — feeds the ICE card (§4.K).
- Profiles drive everything else: goals, metrics, documents, medications, and reminders are all scoped to a profile.

### 4.B Health Goals & tracking *(core)*
The analog of myFinance's goals + ETA projection.

- Goal types: **weight** (lose/gain/maintain to target), **body composition** (BMI, body-fat), **vitals targets** (BP < X, fasting glucose < Y, HbA1c < Z), **fitness** (steps/day, workouts/week, run distance), **habit** (water intake, sleep hours, medication adherence), **preventive** (complete an annual screening).
- Each goal has a baseline, target, target date, and a **deterministic projection** ("at your current 7-day trend you'll reach 75 kg around 2026-09") — the health analog of myFinance's `goals.ts` ETA math.
- Progress surfaced as a trend line + "on track / behind / ahead" status. No coaching language that implies medical advice.
- Goals for self **and** any family member.

### 4.C Metrics & vitals tracking *(core)*
- Time-series log of: weight, BMI (derived), blood pressure, resting heart rate, blood glucose (fasting/PP/random), SpO2, temperature, waist, sleep hours, steps, mood/energy.
- Lab results (from import or manual) become metrics too, so a single test (e.g. HbA1c, LDL) trends across visits.
- **Reference-range flagging is deterministic** — a value outside a baked/standard range is flagged H/L with a "not medical advice; discuss with your doctor" note. No interpretation beyond the range comparison.
- Charts per metric; multi-metric overlay; export.

### 4.D Document import — prescriptions & lab reports *(core, the differentiator)*
This is the health analog of myFinance's Excel pipeline, and it is specified in full by [`medical-document-parser-architecture.md`](./medical-document-parser-architecture.md). Summary of how it appears as a product feature:

- **Inputs:** native-text PDF, scanned PDF, phone photo. A **capture quality gate** asks for a retake on glare/blur before wasting effort.
- **Two document types:** **pathology/lab reports** (tractable — table extraction + test-name normalization → metrics) and **prescriptions** (printed → tractable; handwritten → routed to assisted human entry).
- **Confidence-tiered review UI:** high → auto-accept; medium → pick from ranked *real* candidates (drugs from a formulary, tests from a standard vocabulary) + free-text "Other"; low/handwritten → manual entry, dictionary-assisted.
- **Safety gating:** drug name and dosage are **confirm-required** when not from native text. The system never silently fills a dose.
- **Output → app data:** an imported lab report populates metrics & lab history; an imported prescription populates a medication list + a document record. Every field carries **provenance** (native-text / OCR / human) and **confidence**.
- **Correction log:** every human action is captured locally as trainable data tied to the source lab/doctor — the basis for later, on-device improvement.

> This is the load-bearing UX decision: **native-text PDFs skip the wizard entirely** (instant, perfect), exactly like myFinance's "default Excel schema = skip wizard." The review wizard is the fallback path for scans/photos/handwriting, not the default.

### 4.E Medications & reminders *(core)*
Builds on the shared reminder engine (derived vs. manual reminders + OS notifications — see [`SHARED_CORE.md`](./SHARED_CORE.md)).

- Medication list per profile: drug, strength, form, schedule (OD/BD/TDS/QID/custom), start/end, prescriber, linked source document.
- **Derived reminders:** dose times, refill-due (from quantity + schedule), prescription-expiry, lab-recheck-due, appointment-due, vaccine-due, screening-due.
- **Manual reminders:** anything the user types.
- Adherence tracking: mark dose taken/skipped; adherence % feeds a habit goal.
- One OS notification per sweep (same pattern as myFinance), graceful no-op without permission.

### 4.F Immunizations & preventive screenings *(core-ish)*
- **Immunization record** per profile (vaccine, date, dose #, batch, provider). For children, compare against a **baked standard schedule** (e.g. IAP/national childhood schedule) to surface "due/overdue" — deterministic, with disclaimer.
- **Preventive-screening planner** by age/sex from **baked guidelines** (e.g. annual physical, lipid panel, mammogram/Pap by age, diabetes screening, eye/dental). Generates reminders. Deterministic; advisory; not a substitute for a doctor.

### 4.G Document vault *(core, sensitive)*
Uses the shared encrypted-document machinery (per-device DEK in Stronghold, AES-256-GCM blobs under `<appDataDir>/documents/`, metadata in SQLite — see [`SHARED_CORE.md`](./SHARED_CORE.md)).

- Store originals: prescriptions, lab reports, discharge summaries, scans, imaging, bills, insurance docs, IDs.
- Tag by profile, type, date, provider; full-text on extracted text where available.
- A **health timeline** view: every document, visit, lab, medication change, and vaccine in chronological order per profile.

### 4.H Professionals directory — *gated master* 
Built on the shared **partners/directory** master + OTA mechanism ([`SHARED_CORE.md`](./SHARED_CORE.md)). **Invisible until the user reaches a tier AND the owner has published data.**

A curated, signed, OTA-pushed directory of health professionals, keyed by **professional type**. Types myHealth recognizes (extensible via masters):

- **Doctors — general:** General Physician / Family Doctor, Pediatrician.
- **Doctors — specialists:** Cardiologist, Endocrinologist (diabetes/thyroid), Gastroenterologist, Nephrologist, Neurologist, Oncologist, Orthopedist, Pulmonologist, Rheumatologist, Urologist, ENT, Ophthalmologist, Dermatologist, Gynecologist/Obstetrician, Psychiatrist, General Surgeon.
- **Dental & vision:** Dentist, Orthodontist, Optometrist.
- **Nutrition & diet:** Nutritionist, Clinical Dietician, Diabetes Educator.
- **Fitness & movement:** Personal/Fitness Trainer, Yoga Teacher, Pilates Instructor, Physiotherapist, Sports Coach, Zumba/Dance-fitness Instructor.
- **Wellness & mind:** Health/Wellness Coach, Psychologist, Counselor/Therapist, Meditation/Mindfulness Coach, Sleep Specialist.
- **Therapies:** Occupational Therapist, Speech & Language Therapist, Audiologist, Podiatrist, Massage Therapist.
- **Traditional & complementary:** Ayurveda Practitioner, Homeopath, Naturopath, Acupuncturist, Chiropractor.
- **Care & support:** Home-care Nurse, Caregiver/Attendant, Lactation Consultant, Midwife/Doula, Pharmacist, Lab/Diagnostic Center.

Users can always add their *own* providers (custom options, never deleted); the directory merely supplements with curated, verified entries when available.

### 4.I Health-items catalog — *gated master*
A second signed, OTA-pushed reference set — **invisible until tier + published data**. Lets a user reference real items (with structured attributes) when logging diet, supplements, or equipment. Categories myHealth recognizes (extensible):

- **Food** (whole foods, packaged, prepared meals) — with nutrition facts (calories, macros, key micros).
- **Drinks / beverages** — incl. health drinks, electrolytes, with nutrition facts.
- **Supplements** — vitamins, minerals, protein, omega-3, probiotics, with typical serving/dosage.
- **Medications / OTC** — reference entry only (name, strength, form); never dosing advice.
- **Gym / fitness equipment** — treadmills, weights, resistance bands, etc., with specs.
- **Yoga & mobility props** — mats, blocks, straps, bolsters.
- **Wearables / fitness trackers** — bands, smartwatches.
- **Medical devices** — BP monitor, glucometer, pulse oximeter, thermometer, weighing scale, nebulizer.
- **Home test kits**, **herbal/Ayurvedic products**, **personal-care/hygiene**, **fitness apparel/footwear**, **sleep aids**, **mobility aids**.

These power optional logging features (food diary, supplement stack, equipment owned) — all of which degrade gracefully to free-text when the catalog isn't present.

### 4.J Tiers & feature gating
Uses the shared gamification + feature-gate model (tiers newcomer → regular → expert, grant-only patron/partner — see [`SHARED_CORE.md`](./SHARED_CORE.md)).

- **Local-only usage telemetry** (launch days, features touched) unlocks tiers **on-device** — never transmitted.
- **Gated-behind-tier features:** the professionals directory (§4.H), the health-items catalog (§4.I), device-to-device sync, and any other "advanced" surface.
- **Double gate** for master content: visible only when *both* the tier is reached *and* the owner has actually published a signed bundle. Until then the menu entry doesn't appear (no teaser).

### 4.K Emergency / ICE card *(core)*
Uses the shared ICE/emergency primitives, narrowed to medical.

- A printable/shareable **medical ICE card** per profile: blood group, allergies, chronic conditions, current meds, emergency contacts, primary doctor, insurance, organ-donor & advance-directive notes.
- Click-to-call/email emergency contacts (deterministic regex extraction from the shared emergency helpers).
- Always shows the universal emergency disclaimer.

### 4.L Reports & doctor-visit summary *(high value)*
- One-tap **"prepare for a doctor visit"**: a self-contained PDF/HTML for a chosen profile — current meds, recent labs with trends, active conditions, allergies, recent symptoms, open questions. (Uses the shared HTML→PDF report machinery.)
- Passphrase-encrypted **register export / family health pack** (shared PBKDF2→AES-GCM packaging) so a family member can open it without the vault.

### 4.M Family health history *(record-keeping)*
- Structured family-history record (conditions by relation) — deterministic record-keeping for "discuss with your doctor," **not** risk scoring.

---

## 5. Suggested additional features (along the same line)

Ranked roughly by value/fit. All deterministic, offline, no interpretation.

1. **Symptom & health journal** — date-stamped free-text + tags (pain, fever, mood, energy, sleep quality), attachable to a profile and surfaced on the timeline and in the doctor-visit summary.
2. **Appointments tracker** — upcoming visits per profile/provider, with reminders and a "what to bring / questions to ask" note; feeds the doctor-visit summary.
3. **Wearable / health-app data import** — receive-only file import of Apple Health / Google Fit / Fitbit / Garmin CSV/XML exports into the metrics store (steps, HR, sleep, weight). No live API, no account linking — same "import a file" philosophy as myFinance's Excel path.
4. **Children's growth charts** — plot height/weight/head-circumference against **baked WHO/IAP percentile curves**; deterministic, advisory.
5. **Menstrual / cycle tracking** — period log, cycle-length trend, predicted next date (deterministic), with privacy emphasis.
6. **Food / nutrition diary & water intake** — log meals (free-text or from the items catalog), daily calorie/macro rollup, hydration; feeds nutrition goals.
7. **Activity / workout log** — sessions, type, duration, with equipment from the catalog; feeds fitness goals.
8. **Sleep log** — manual or imported; trend + sleep-hours habit goal.
9. **Chronic-condition care plans** — a per-condition checklist/template (e.g. diabetes: HbA1c every N months, annual eye/foot check, daily glucose) that auto-generates reminders. Deterministic templates, not advice.
10. **Lab-trend dashboard** — pick any imported test and see it across all visits with reference-range bands.
11. **Health expense tracking + optional bridge to a finance app** — log medical bills/insurance claims; *if* the user also runs myFinance, optionally export a file summary it can ingest. The bridge is **file-based and one-directional** — neither app depends on the other being installed.
12. **Multi-profile dashboard** — household overview: who has something due (vaccine, refill, screening, appointment) this week.
13. **Device-to-device LAN sync** — the shared two-way LWW sync so a couple can keep the family record in step across two devices, no backend. Gated to expert tier.
14. **Allergy / interaction *flags from the prescription itself*** — surface only what the document/label states; **never** compute interactions (explicit non-goal).
15. **Multi-language UI & document handling** — relevant for Indian-context prescriptions.

---

## 6. Gating model — what is hidden, and when

| Surface | Visible when |
|---|---|
| Profiles, goals, metrics, manual forms, document import, vault, reminders, ICE card, reports | Always (these are the free core) |
| Professionals directory (§4.H) | Tier ≥ threshold **AND** owner has published a signed professionals bundle |
| Health-items catalog (§4.I) | Tier ≥ threshold **AND** owner has published a signed items bundle |
| Device sync (§5.13) | Expert tier |
| Patron-only niceties | Patron grant |

Key rule (from your brief): **master content does not appear at all** — not even as a locked teaser — **until both the tier is earned and you have actually added the data**. The OTA check is receive-only; an empty/absent bundle means the menu entry simply isn't rendered.

---

## 7. Non-goals (explicit)

- No diagnosis, treatment advice, drug-interaction checking, or clinical decision support.
- No cloud LLM; no LLM-based recommendation anywhere in product logic.
- No backend, no web target, no account, no analytics, no phone-home.
- No fully-autonomous extraction of safety-critical fields — human confirmation is mandatory off the native-text path.
- No selling/sharing data — there is no mechanism to, by construction.

---

## 8. Open questions

- **Drug formulary & test vocabulary sources** for India (licensing) — required for the import normalization layer (parser doc open questions).
- **Childhood vaccine & screening schedules** — which authority to bake (IAP vs national), and how to version them via OTA.
- **Import pipeline runtime** — bundled Python sidecar (matches the architecture doc's PyMuPDF/OpenCV/PaddleOCR stack) vs. Rust-native. See [`PLAN.md`](./PLAN.md) §4.
- **How much of the items catalog ships baked vs OTA**, and the minimum viable attribute set per category.
- **Regulatory framing** — disclaimers are necessary but is any "health record" classification triggered in target geographies? (Stay firmly on the record-keeping side of the line.)
