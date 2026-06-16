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

### 4.D Document import — prescriptions, lab reports & insurance cards *(core, the differentiator)*
This is the health analog of myFinance's Excel pipeline, and it is specified in full by [`medical-document-parser-architecture.md`](./medical-document-parser-architecture.md). **Import is not a separate page — it is the Documents vault** (Caretaker tier): adding/scanning a document *is* importing it, so there is one feature, not two. Summary of how it appears as a product feature:

- **Inputs:** native-text PDF, scanned PDF, phone photo. A **capture quality gate** asks for a retake on glare/blur before wasting effort. (Recognition runs through the `@scandoc/core` `Recognizer` seam; until the on-device OCR sidecar ships, text input is pasted/edited for image/PDF scans.)
- **Three document types:** **pathology/lab reports** (tractable — table extraction + test-name normalization → metrics), **prescriptions** (printed → tractable; handwritten → routed to assisted human entry), and **medical insurance cards** (policy fields + covered members).
- **Insurance-card member add:** scanning an insurance card extracts the **covered members**; any member not yet in the app is **proposed for adding to the family** in a propose-then-confirm review (editable name/relationship/DOB; the card's "self" maps to the existing self profile). Confirmed members are created as profiles — so a scan fills in missing family members. Creating a person is always confirm-required.
- **Confidence-tiered review UI:** high → auto-accept; medium → pick from ranked *real* candidates (drugs from a formulary, tests from a standard vocabulary) + free-text "Other"; low/handwritten → manual entry, dictionary-assisted.
- **Safety gating:** drug name and dosage are **confirm-required** when not from native text. The system never silently fills a dose.
- **Output → app data:** an imported lab report populates metrics & lab history; an imported prescription populates a medication list + a document record. Every field carries **provenance** (native-text / OCR / human) and **confidence**.
- **Correction log:** every human action is captured locally as trainable data tied to the source lab/doctor — the basis for later, on-device improvement.

> This is the load-bearing UX decision: **native-text PDFs skip the wizard entirely** (instant, perfect), exactly like myFinance's "default Excel schema = skip wizard." The review wizard is the fallback path for scans/photos/handwriting, not the default.

### 4.E Medications & reminders *(core)*
Builds on the shared reminder engine (derived vs. manual reminders + OS notifications — see [`SHARED_CORE.md`](./SHARED_CORE.md)).

- Medication list per profile: drug, strength, form, schedule (OD/BD/TDS/QID/custom), start/end, prescriber, linked source document.
- **Derived reminders:** dose times, refill-due (from quantity + schedule), prescription-expiry, lab-recheck-due, appointment-due, vaccine-due, screening-due, **hydration (water-intake) pings**, and **daily-task/schedule reminders** (§4.N).
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

### 4.J Progressive disclosure & health tiers *(core UX)*
The app must **not intimidate a new user with dozens of features**. myHealth opens minimal and **earns the user's way into depth** as they actually use it. Built on the shared gamification + feature-gate engine ([`SHARED_CORE.md`](./SHARED_CORE.md)), but with a health-flavored ladder and three visibility states. **All unlock signals are local-only telemetry — never transmitted.**

#### Three visibility states for every feature
- **Open** — available now at the current tier.
- **Nudge** (shown but locked, with a one-line CTA) — *"Log a metric to unlock goal tracking."* A gentle teaser that tells the user the single next action to open it. Used to guide newcomers without clutter. (This is a per-feature prerequisite gate, independent of tier.)
- **Hidden** — not rendered at all until a tier is reached. Used for complex/advanced features so a newcomer never even sees them. (Master content is additionally hidden until the owner publishes data — the *double gate*.)

#### The tier ladder (earned through use)
The ladder is **app-defined config** passed to the shared tier engine (ordered tiers, each with a local unlock predicate). Names and criteria below are tunable.

| Tier | Unlock signal (example, tunable) | What it reveals |
|---|---|---|
| **🌱 Starter** (default) | — everyone starts here | Your own profile · the **Today** view (daily tasks + **water intake**) · one-tap vitals logging · add a document (native-text/simple path) |
| **📈 Tracker** | finished your profile **and** logged data on **≥5 distinct days** (or ≥3 days + set 1 goal) | Family-member profiles · **health goals + projections** · trends/charts · **guided content library** (Yoga, Exercises … §4.O) · medications + dose/refill reminders · the **daily/weekly schedule** · reminders center |
| **🧭 Caretaker** | **≥2 profiles** · active on ≥8 days across ≥1 month · used import at least once | Full import wizard (scans/photos/handwriting) + lab-trend dashboard · immunizations + screening planner · medical ICE card · symptom journal · appointments · doctor-visit summary · **professionals directory eligible** (still double-gated on published data) |
| **🏆 Champion** | **≥20 active days** · every core feature used once · ≥2 profiles with goals | Device-to-device sync · encrypted family health pack / register export · chronic-condition care plans · **health-items catalog eligible** (double-gated) + items-powered diaries · full timeline + advanced analytics |

Grant-only tiers (outrank earned tiers, via the shared mechanism):
- **💗 Supporter** — recorded from a signed donation file; unlocks cosmetic niceties (themes) regardless of earned tier.
- **✅ Verified Pro** — granted to verified health professionals; unlocks partner/professional surfaces.

#### How progress is shown (motivate, never nag)
A subtle **"Your journey"** strip shows the next milestone (*"2 more days of logging to reach Tracker"*) and what it will open. Newly unlocked features get a one-time highlight. No badgering, no streak-shaming — the daily tasks (§4.N) are the natural engine that accrues the active-day signals.

#### Double gate for master content
The professionals directory (§4.H) and health-items catalog (§4.I) appear **only when both** the tier is reached **and** the owner has published a signed bundle. Until then the menu entry simply isn't rendered (no teaser).

### 4.K Emergency / ICE card *(core)*
Uses the shared ICE/emergency primitives, narrowed to medical.

- A printable/shareable **medical ICE card** per profile: blood group, allergies, chronic conditions, current meds, emergency contacts, primary doctor, insurance, organ-donor & advance-directive notes.
- Click-to-call/email emergency contacts (deterministic regex extraction from the shared emergency helpers).
- **Shared across the suite:** the card is mirrored into a single common suite-DB table (`common#IceCard`, keyed per person) so another Tokans app (e.g. myFinance) reads and edits the same emergency contact — never a duplicate. Standalone-safe: degrades to the per-profile card when the shared `suite.db` is absent.
- Always shows the universal emergency disclaimer.

### 4.L Reports & doctor-visit summary *(high value)*
- One-tap **"prepare for a doctor visit"**: a self-contained PDF/HTML for a chosen profile — current meds, recent labs with trends, active conditions, allergies, recent symptoms, open questions. (Uses the shared HTML→PDF report machinery.)
- Passphrase-encrypted **register export / family health pack** (shared PBKDF2→AES-GCM packaging) so a family member can open it without the vault.

### 4.M Family health history *(record-keeping)*
- Structured family-history record (conditions by relation) — deterministic record-keeping for "discuss with your doctor," **not** risk scoring.

### 4.N Daily habits — Today, water & schedule *(Starter core; the engagement engine)*
The friendly front door that makes the app a daily habit and drives the usage signals that unlock higher tiers (§4.J).

- **Today view** — the default landing screen at **Starter** tier. A tiny, encouraging checklist of small actions: *log your weight, drink water, take your meds, take a short walk.* Tasks come from the user's own data (active meds → "take meds"; active goals → a nudge) plus a couple of universal starter habits. Checking items off is one tap and feeds adherence/active-day signals. Deliberately short — never a wall of tasks.
- **Water intake** *(Starter)* — a simple hydration tracker with a target (deterministic default by body weight/sex, fully editable) and **+1 glass** quick-add. Opt-in **water reminders** spaced across waking hours (e.g. every 2h, user-set), delivered through the shared reminder/notification engine (§4.E). Hydration trend feeds an optional habit goal.
- **Daily health tasks (custom)** *(Starter → richer at Tracker)* — user-defined recurring tasks (walk 20 min, BP reading, stretch, meditation) with simple schedules (daily / weekdays / specific days) and reminders. Completion history shows a gentle streak.
- **Daily / weekly schedule** *(Tracker)* — a planned day/week laying out medication times, meals, activity blocks, and appointments on a timeline, generating the right reminders. At **Starter** this is **Hidden** (newcomers see a calm, water-first app); it appears and fully opens at **Tracker**. Per-profile, so a caregiver can run a parent's or child's schedule too.

All of the above are **deterministic and offline**; reminders are local OS notifications with a graceful no-op when permission isn't granted. No coaching language implying medical advice.

### 4.O Content library — guided routines *(Tracker)*
A **folder-driven content framework**: each content TYPE is its own tab (ships **Yoga** sequences and **Exercises** routines), and each entry is an ordered list of **steps with an illustration, plain-language instruction, and an optional hold/duration**. Opens at the **Tracker** tier by default, configurable per type (nudged one tier below, hidden further down — §4.J). The app **ships a few baked samples per type** with inline-SVG pose/movement art so each tab is useful **fully offline** the moment the tier unlocks. Adding a new type is just dropping a `content/<type>/` folder — the app auto-discovers it as a tab; on phones content tabs live under the center **heart FAB**, not the "More" drawer. A type can have **subtypes** to any depth (Yoga → Morning / Relax / Balance; Exercises → Mobility / Strength; or, in a study app, board → class → subject → book): the page shows a slim **breadcrumb navigator** at the top where each level — including the next one to pick — is a **dropdown**, and leaf nodes list their entries.

- **Downloadable bundles + a daily background sync** — richer entries are published **separately** as **signed, encrypted bundles on the project's GitHub release** and refreshed by a **once-a-day background sync** via the shared **masters/OTA** engine (§5 table; Ed25519 signature → revision/app-version gate → per-file SHA-256 → AES-GCM transport-decrypt → schema-validate). The same sync reads a **remote type catalog**, so a brand-new tab can appear **without an app update**. **Receive-only** (uploads nothing); downloaded entries merge on top of the baked samples (baked wins id collisions) and bundles can be removed. **Double-gated** in practice: each tab is tier-gated, and downloads only run when the build carries the signing keys and is running in the desktop app — otherwise the baked samples still work.
- **Not medical advice.** General movement/activity guidance with an on-screen disclaimer (move gently, stop if it hurts, check with your doctor for injuries/conditions). No diagnosis, no physiotherapy prescription, no LLM — consistent with the no-medical-interpretation constraint.

### 4.P Data portability — backup & per-tab Excel *(core, on-device)*
Two complementary on-device, receive/emit-only export paths, both producing plain `.xlsx`:

- **Whole-store backup & restore (Settings).** One workbook with a sheet per table — the app's own DB plus this app's slice of the shared suite DB — for disaster recovery / machine migration. Secrets export only as one-way `sha256:` fingerprints and are skipped on import; vault document bytes are never included (shared-core `sharedcorelib/backup`).
- **Per-tab, human-friendly Excel (Reminders, Goals, Schedule, Medications, Vitals) — scoped to the selected profile.** Each tab has its own **Export / Import** buttons producing a small, **hand-editable** single-sheet workbook **for the currently active person only** (the file name carries the profile name; the buttons disable until a profile is selected). The sheet is designed for offline editing in Excel/Sheets — not the raw table shape, and with **no `profile_id`/Person column** since the whole file belongs to one person: `HH:MM` times (not minutes), "Every day"/"Weekdays", "Lower is better"/"Higher is better"/"Maintain", "Yes/No" flags, metric labels. Re-import is **update-by-ID + add-new**, confined to that profile: each row carries an `ID`; an ID matching one of *this profile's* records updates it, any other ID (blank, or belonging to another person) is added as a new row **under the active profile** — so a sheet can never overwrite another person's data. The import reports per-row added/updated/skipped counts with row-numbered warnings (missing required cell). The Reminders sheet also shows the **auto** water/task/medication nudges (an `Auto` column) so it mirrors that person's inbox, but those rows are app-managed and skipped on import; exporting a tab with no data yet saves a **blank, fillable template** instead of an empty-looking file. On-device only — nothing is uploaded, and vault document bytes are never part of these sheets. *(Engine: `src/lib/featureExcel.ts`; UI: `src/components/feature/ExcelButtons.tsx`.)*

---

## 5. Suggested additional features (along the same line)

Ranked roughly by value/fit. All deterministic, offline, no interpretation.

1. **Symptom & health journal** — date-stamped free-text + tags (pain, fever, mood, energy, sleep quality), attachable to a profile and surfaced on the timeline and in the doctor-visit summary.
2. **Appointments tracker** — upcoming visits per profile/provider, with reminders and a "what to bring / questions to ask" note; feeds the doctor-visit summary.
3. **Wearable / health-app data import** — receive-only file import of Apple Health / Google Fit / Fitbit / Garmin CSV/XML exports into the metrics store (steps, HR, sleep, weight). No live API, no account linking — same "import a file" philosophy as myFinance's Excel path.
4. **Children's growth charts** — plot height/weight/head-circumference against **baked WHO/IAP percentile curves**; deterministic, advisory.
5. **Menstrual / cycle tracking** — period log, cycle-length trend, predicted next date (deterministic), with privacy emphasis.
6. **Food / nutrition diary** — log meals (free-text or from the items catalog), daily calorie/macro rollup; feeds nutrition goals. (Water intake is core — see §4.N.)
7. **Activity / workout log** — sessions, type, duration, with equipment from the catalog; feeds fitness goals.
8. **Sleep log** — manual or imported; trend + sleep-hours habit goal.
9. **Chronic-condition care plans** — a per-condition checklist/template (e.g. diabetes: HbA1c every N months, annual eye/foot check, daily glucose) that auto-generates reminders. Deterministic templates, not advice.
10. **Lab-trend dashboard** — pick any imported test and see it across all visits with reference-range bands.
11. **Health expense tracking + optional bridge to a finance app** — log medical bills/insurance claims; *if* the user also runs myFinance, optionally export a file summary it can ingest. The bridge is **file-based and one-directional** — neither app depends on the other being installed.
12. **Multi-profile dashboard** — household overview: who has something due (vaccine, refill, screening, appointment) this week.
13. **Device-to-device LAN sync** — the shared two-way LWW sync so a couple can keep the family record in step across two devices, no backend. Gated to **Champion** tier.
14. **Allergy / interaction *flags from the prescription itself*** — surface only what the document/label states; **never** compute interactions (explicit non-goal).
15. **Multi-language UI & document handling** — relevant for Indian-context prescriptions.

---

## 6. Gating model — what shows, what nudges, what's hidden

Maps each surface to a tier (§4.J) and a visibility **state**: **Open** (usable now), **Nudge** (shown locked with a one-line "do X" CTA), or **Hidden** (not rendered until the tier).

| Surface | Tier | State before unlock |
|---|---|---|
| Own profile · Today view (daily tasks + water + water reminders) · vitals logging · reminders inbox | **Starter** | Open |
| Add a family member | Starter→**Tracker** | **Nudge:** *"Finish your own profile first."* |
| Import medical documents | **Caretaker** | **Nudge** (teased even at Starter): *"Reach the Caretaker tier to import prescriptions & lab reports."* — the headline reason to climb the ladder, so it's shown-locked rather than hidden |
| Set a health goal · build your schedule · goals + projections · trends/charts · family profiles · medications · document vault · reminders center | **Tracker** | Hidden at Starter |
| Lab-trend dashboard · immunizations + screenings · ICE card · journal · appointments · doctor-visit summary | **Caretaker** | Hidden below Caretaker |
| Professionals directory (§4.H) | **Caretaker** | Hidden — **and** double-gated: appears only once the owner has published a signed bundle |
| Device sync · family health pack export · care plans · advanced analytics | **Champion** | Hidden below Champion |
| Health-items catalog (§4.I) + items-powered diaries | **Champion** | Hidden — **and** double-gated on a published bundle |
| Cosmetic niceties (themes) | **Supporter** (grant) | Hidden until granted |
| Professional/partner surfaces | **Verified Pro** (grant) | Hidden until granted |

Two key rules:
1. **Newcomers see a calm, small app.** Only Starter surfaces render; everything heavier is Hidden, with a few **Nudges** pointing at the single next action.
2. **Master content double-gates.** The directory and items catalog never appear — not even as a locked teaser — **until both** the tier is earned **and** the owner has actually published the signed data. The OTA check is receive-only; an absent bundle means the entry isn't rendered.

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
