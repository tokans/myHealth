# myHealth — Architecture & Delivery Plan

**Status:** Living plan (v0.1 — pre-implementation)
**Read first:** [`PRODUCT_FEATURES.md`](./PRODUCT_FEATURES.md), [`SHARED_CORE.md`](./SHARED_CORE.md), and [`medical-document-parser-architecture.md`](./medical-document-parser-architecture.md).
**Design stance:** myHealth is a **standalone** local-first app built on a **shared core package** (`sharedcorelib` — see [`SHARED_CORE.md`](./SHARED_CORE.md)) that provides app-agnostic subsystems (vault, masters/OTA, tiers, reminders, sync, report export, ICE, UI primitives) via **dependency injection**. myHealth supplies its own config, schema, domain logic, and the one genuinely new subsystem: the **medical document import pipeline**. The app **never depends on a sibling app**; if the shared package does not yet exist, these subsystems are implemented in-app and extracted later. This plan marks each subsystem as *shared-core* or *app-specific*.

---

## 1. Locked technology decisions (shared local-first stack)

> These are the conventions of the shared core ([`SHARED_CORE.md`](./SHARED_CORE.md)); any app in the family adopts them.

| Concern | Decision |
|---|---|
| Shell | Tauri v2 (Rust) + system webview |
| Frontend | React 18 + TypeScript + Vite |
| Routing | HashRouter (Tauri loads from `file://`) |
| State | Zustand stores, hydrate-from-disk |
| Data fetching | TanStack Query over `src/db/*` wrappers |
| UI | Tailwind + shadcn/ui primitives; bottom-tab (mobile) / sidebar (desktop) |
| Local DB | SQLite via `tauri-plugin-sql`; append-only numbered migrations |
| Secrets/docs | Stronghold vault; per-device DEK; AES-256-GCM document blobs |
| Crypto for exports | PBKDF2 → AES-GCM (`packageCrypto.ts` equivalent) |
| Masters/OTA | Signed (Ed25519) + encrypted (AES-GCM) bundles from GitHub Releases; receive-only |
| Reminders | derived + manual; OS notifications via `tauri-plugin-notification` |
| Sync | Optional LAN device-to-device, LWW, no backend (gated to **Champion** tier) |
| Tiers | App-defined **ordered ladder** (Starter→Tracker→Caretaker→Champion + grant tiers) passed to the shared engine; local-only unlock predicates |
| Reports | HTML → PDF, self-contained |
| Path alias | `@/` → `src/` |

**Net-new (app-specific):** the **import pipeline** (OCR/parse) and its possible **Python sidecar** (§4). Everything else comes from the shared core.

---

## 2. High-level architecture

Two-process Tauri app (the shared local-first shape):

```
React/TS webview  ──(Tauri commands / plugins)──>  thin Rust shell
   │                                                  │
   ├─ pages/ (Profiles, Goals, Metrics, Import,       ├─ tauri-plugin-sql (SQLite)
   │   Medications, Vault, Timeline, Directory…)      ├─ tauri-plugin-stronghold (vault)
   ├─ domain/ (pure: goals, trends, schedules,        ├─ tauri-plugin-fs / dialog / os
   │   ranges, ice, careplans …)                      ├─ tauri-plugin-http (receive-only OTA)
   ├─ db/ (typed wrappers over migrations)            ├─ tauri-plugin-notification
   ├─ vault/ (stronghold + docCrypto)                 ├─ tauri-plugin-opener
   ├─ masters/ (registry + OTA + verify)              ├─ sync.rs (LAN byte pipe)  [optional]
   ├─ import/ (capture, review UI, mapping)           └─ parser sidecar bridge   [NEW, §4]
   ├─ stores/ (settings, profiles, tier, gating)
   └─ lib/ (env, tiers, gating, notify, report)
```

### 2.1 Rust shell (`src-tauri/`)
- `src/lib.rs` registers plugins + embeds migrations (the shared `Vec<Migration>` runner pattern). New plugin beyond the shared baseline: possibly **`tauri-plugin-shell`/sidecar** to invoke the parser binary (§4).
- `capabilities/default.json` must grant: FS scope for `documents/` + import temp dir, http allowlist for the OTA release host, notification, shell/sidecar (if used), camera/file-picker for capture.

### 2.2 Frontend (`src/`)
Same conventions as myFinance. New domain area is `src/import/` (review UI + field-mapping) and `src/domain/` health logic.

### 2.3 Data layer (`src/db/`)
- `client.ts` lazily opens `sqlite:myhealth.db`. `getDb()` throws outside Tauri — pages gate with `isTauri()` (shared environment helper).
- All schema in append-only migration SQL files. TS `db/*` files are typed wrappers only.

---

## 3. Data model sketch (initial migrations)

Numbered, append-only, `include_str!`'d into `lib.rs` — shared migration discipline ("never edit a shipped migration").

| # | Migration | Tables (sketch) |
|---|---|---|
| 0001 | init / settings | `settings` (currency-less; locale, dateFormat, units metric/imperial, FY-style n/a) |
| 0002 | profiles | `profiles` (member, relationship, dob, sex, blood_group, height, photo_ref), `profile_baseline` (allergies, conditions, lifestyle as rows) |
| 0003 | metrics | `metrics` (profile_id, kind, value, unit, taken_at, source, confidence), indexed by (profile_id, kind, taken_at) |
| 0004 | lab_results | `lab_panels`, `lab_results` (test_canonical, raw_name, value, unit, ref_low, ref_high, flag, source_doc) |
| 0005 | medications | `medications` (profile_id, drug, strength, form, schedule, start, end, prescriber_id, source_doc), `med_doses` (adherence log) |
| 0006 | goals | `goals` (profile_id, kind, baseline, target, target_date, status) |
| 0007 | documents | `documents` (uuid blob ref, profile_id, type, provider, date, extracted_text) — vault-sealed blobs |
| 0008 | immunizations | `immunizations` (profile_id, vaccine, dose_no, date, batch, provider_id) |
| 0009 | reminders | `reminders` (manual + derived w/ dedupe_key) — shared reminders schema |
| 0010 | people/providers | `providers` (the user's own + linked directory entries), reused as prescriber/doctor/contact |
| 0011 | import_corrections | `import_corrections` (structured human-correction log — parser doc §6.8) |
| 0012 | appointments | `appointments` (profile_id, provider_id, when, notes, prep) |
| 0013 | journal | `symptom_journal` (profile_id, date, text, tags) |
| 0014 | family_history | `family_history` (profile_id, relation, condition) |
| 0015 | care_plans | `care_plans` + `care_plan_items` (template-instantiated) |
| 0016 | usage | `app_launches` etc. — shared tier-telemetry schema (local-only) |
| 0017 | master_options | OTA reference rows — shared masters schema |
| 0018 | custom_options | user-typed "Other" values — shared masters schema |
| 0019 | directory (partners) | health-professionals directory — shared directory schema (`partners`) |
| 0020 | health_items | OTA items catalog (food/drinks/supplements/equipment…) |
| 0021 | sync | device-sync change log — shared sync schema |
| 0022 | daily habits | `daily_tasks` (profile_id, title, recurrence, reminder_time), `task_completions` (task_id, date), `water_log` (profile_id, day, glasses, target), `schedule_blocks` (profile_id, kind, start, end, ref) |

(Exact numbering finalized at implementation; this is the shape, not the contract.)

> **Tier config (not a migration):** the Starter→Tracker→Caretaker→Champion ladder + grant tiers is an **app-supplied ordered list** of `{ name, unlockPredicate }` passed to the shared tier engine (so `sharedcorelib` must support an N-tier ladder, not a hardcoded 3). Unlock predicates read the local usage telemetry (`app_launches`, distinct active days, features touched) + app data (profile count, goals set) — all on-device. Per-feature **Nudge** prerequisites live in the shared gating store.

---

## 4. The import pipeline (the one new subsystem)

The product behavior is specified by [`medical-document-parser-architecture.md`](./medical-document-parser-architecture.md). The **integration question** for a Tauri app is *where the CPU pipeline runs*, because that architecture is Python/OpenCV/PaddleOCR-centric while myHealth's shell is Rust+TS.

### 4.1 Split by stage
- **Native-text fast path** (PDF carrying selectable text → take it directly): do this **in TS/Rust**, no model. Many lab/EHR PDFs are native-text → instant, perfect, *skip the wizard* (the load-bearing UX win, mirroring myFinance's default-schema auto-detect).
- **Image normalization + OCR + region/handwriting classification** (the heavy, model-bearing stages): run in a **bundled local sidecar**.
- **Domain-constrained field extraction + confidence tiering + review UI + correction logging**: **TS** in the webview (`src/import/`), because it's UI + deterministic vocab matching, and it must own the human-in-the-loop gating.

### 4.2 Recommended approach — bundled Python sidecar (decision to confirm)
Ship the architecture doc's stack (PyMuPDF, OpenCV, PaddleOCR/Tesseract, optional small VLM-OCR) as a **PyInstaller-frozen sidecar binary** invoked via Tauri's sidecar/`shell` plugin. The webview sends a file path + options; the sidecar returns the structured JSON schema from parser doc §6.9 (fields with `source` + `confidence`); the webview runs the confidence-tiered review.

- **Pros:** reuses the exact, battle-tested stack the architecture doc commits to; keeps Rust thin; fully offline; CPU-only.
- **Cons:** fat binaries per-platform; Android/iOS sidecar story is hard (mobile likely starts native-text-only + manual entry, OCR added later or via on-device alternatives).
- **Alternative considered:** Rust-native (tesseract-rs/leptonica bindings, `pdfium`/`lopdf` for PDF, `image`/`imageproc` for normalization). Leaner distribution, but reimplements what the architecture doc already specifies in Python, and PaddleOCR has no first-class Rust path. **Default to the sidecar; revisit if distribution pain outweighs reuse.**

### 4.3 Safety contract (non-negotiable)
- Sidecar output is **a proposal**, never authority.
- Drug name & dosage and lab values from non-native-text sources are **confirm-required** in the review UI.
- Optional small VLM-OCR is **off the hot path**, used only on flagged hard pages, and its output is surfaced *with confidence* and *never auto-filled* (hallucination = patient-safety event — parser doc §6.5, §10).
- Every human correction → `import_corrections` (local, trainable, tied to source lab/doctor).

### 4.4 Output → app mapping
- **Lab report** → `lab_panels`/`lab_results` + `metrics` (so each test trends) + a `documents` row (sealed original).
- **Prescription** → `medications` (+ derived dose/refill reminders) + a `documents` row.
- Provenance + confidence persisted on every imported field.

---

## 5. Shared-core subsystems (consumed via `sharedcorelib`)

Each row is a **mechanism** provided by the shared core, parameterized by **app-supplied config** (dependency injection — no module-level singletons). myHealth provides the config/adapters in the right column. If the shared package isn't available yet, the same subsystem is implemented in-app and extracted later. See [`SHARED_CORE.md`](./SHARED_CORE.md) for the full contract.

| Shared module | What the core provides | What myHealth supplies (config/adapter) |
|---|---|---|
| Vault + doc crypto | Stronghold wrapper, per-device DEK, AES-256-GCM blob seal/unseal | app data dir, snapshot filename, **per-app Argon2 salt/params**, DEK key id |
| Masters/OTA | Ed25519 verify + AES-GCM transport + monotonic-revision + 4-layer merge + GitHub-Releases pull | release repo/tag, signing public key, transport key, **its own registry** (`professional_type`, item categories) + zod schemas; bundle types `providers` & `health_items` |
| Tiers & gamification | tier computation, launch telemetry | tier thresholds, the "core feature" set, grant tiers |
| Feature gating | gate framework + `FeatureGuard` + gating store | gate definitions: `directory`, `items`, `sync` + prerequisites |
| Reminders | derived+manual model, sweep, bucketing, one-notification-per-sweep | **derived-reminder generators**: dose, refill, recheck, vaccine, screening, appointment |
| Reports/export | HTML→PDF harness, PBKDF2→AES-GCM export sealing | templates: doctor-visit summary, family health pack |
| ICE/emergency | contact extraction + ICE-card primitives | medical ICE fields |
| Sync | LAN transport (Rust pipe) + envelope crypto + LWW merge | **sync adapter**: which health tables sync + change-set schema |
| UI primitives | shadcn/ui set, `AppShell` (sidebar/bottom-tab), `FiniteSetInput`, common forms | nav config, theme, copy |

The **double-gate rule** for master content (tier earned **AND** owner-published bundle present) is the shared gating store's behavior: the route/menu entry isn't rendered until `tier ≥ threshold && bundlePresent`. No teaser state.

---

## 6. Phased roadmap

**Phase 0 — scaffold (clone the skeleton). ✅ DONE.**
Bootstrap Tauri+React+TS; settings store, AppShell, routing, SQLite client, migrations, vault wiring, `core_bootstrap.rs`, consumption of `sharedcorelib` (vault/tiers/gating/env/ui/common-masters). Frontend builds green (`npm run build`).

**Phase 1 — the core record + calm first-run (no import yet). 🟡 IN PROGRESS.**
_Landed:_ profiles (self+family), vitals logging, the Today view (water + daily tasks), the tier ladder + progressive-disclosure shell (Open/Nudge/Hidden + `FeatureGuard`), the "Your journey" screen. _Remaining:_ goals + deterministic projection, daily/weekly schedule, document vault UI, ICE card, reminder-sweep wiring, medications, doctor-visit report. **Plus the Starter experience: the Today view, water intake + reminders, and daily health tasks (§4.N of the product doc), and the progressive-disclosure shell** — the Starter→Tracker→Caretaker→Champion ladder with Open/Nudge/Hidden states — so the app feels small and unintimidating from first launch while heavier features stay hidden/nudged until earned. (The daily/weekly schedule opens at Tracker.) This is a complete, useful app on manual data alone.

**Phase 2 — the tractable 80% of import.**
Native-text PDF fast path (TS). Sidecar for image-normalization + printed OCR. **Pathology table extraction + test normalization → metrics/lab history.** Printed-prescription extraction + formulary match → medications. Confidence-tiered review UI + correction logging. (Mirrors the architecture doc's Phase 1.)

**Phase 3 — handwriting & hard pages.**
Handwritten-prescription route = dictionary-assisted human entry. Evaluate small VLM-OCR as *assist only* on flagged pages. (Architecture doc Phase 2.)

**Phase 4 — gated reference data.**
Masters/OTA port; publish (owner-side) the professionals directory + health-items catalog; wire double-gating + tiers. Items-powered logging (food/supplement/activity diaries) appears only when catalog present.

**Phase 5 — breadth & sync.**
Immunizations + preventive-screening planner, appointments, symptom journal, growth charts, cycle tracking, wearable file import, care plans, family-health-pack export, LAN device sync. (Per §5 of the product doc, prioritized by value.)

**Phase 6 — improvement loop.**
Use logged corrections to fine-tune recognition for the user's own handwriting/labs; add ML dewarping only if real-world curl is shown to hurt accuracy. (Architecture doc Phase 3.)

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| OCR/VLM hallucinates a dosage or lab value | Confirm-required gating; native-text path preferred; confidence surfaced; never auto-fill safety-critical fields |
| Sidecar distribution bloat / mobile gap | Native-text + manual on mobile first; sidecar desktop-first; revisit Rust-native if needed |
| Perceived as medical advice | Hard non-goal; deterministic-only; disclaimers on every interpretive-looking surface |
| Formulary / LOINC / schedule licensing | Resolve sources before Phase 2 (open question); ship via versioned OTA so they update without app releases |
| Reviewer fatigue → rubber-stamping | Confidence tiering (only ambiguous fields surface), same as architecture doc §6.7 |
| Sensitive-data leakage | Client-only + receive-only by construction; encrypted vault; no analytics; no phone-home |
| Migration drift | Append-only numbered migrations; never edit shipped ones (shared discipline) |

---

## 8. What to build first (concrete next step after these docs)

1. Confirm the **import runtime decision** (Python sidecar vs Rust-native) — §4.2.
2. Confirm **formulary / test-vocabulary / vaccine-schedule sources**.
3. Scaffold Phase 0, then deliver Phase 1 (manual-data app) end-to-end before touching OCR. The manual app must stand on its own — import is an accelerant, not a dependency.

---

## 9. Packaging & runtime sharing (first app installs the core, second reuses it)

Full design in [`SHARED_CORE.md`](./SHARED_CORE.md) §7. Summary as it affects myHealth:

- **Two layers.** The build-time TS/React core library is **bundled into myHealth's webview bundle** (small; not runtime-shared). The **heavy runtime assets** — the OCR sidecar + models (§4) and the **OTA masters download cache** — install into a **shared per-user suite dir** (`%LOCALAPPDATA%\SharedCoreLib\core` and platform equivalents) and are **reused** across suite apps.
- **Startup bootstrap (Rust, `lib.rs` setup).** On launch: lay down / upgrade the shared assets from myHealth's bundled copy only if absent or older; otherwise reuse. Register myHealth in the manifest `owners[]`. **Standalone fallback:** if the shared dir is missing/unwritable, use myHealth's own bundled copy — so myHealth installed alone always works.
- **Uninstall** removes myHealth from `owners[]`; the shared dir is deleted only when empty.
- **Masters cache** path is injected = `<shared dir>/masters` so whichever suite app pulls first downloads, and the rest reuse the bytes (each still applies only its own registered master types to its own SQLite).
- **Never shared:** the vault (per-app salt), `myhealth.db`, and settings — strictly per-app.
- **Decision dependency:** the OCR sidecar (§4.2) is the largest shared asset — its size is the main reason to share L2. If the import runtime ends up Rust-native/light, L2 sharing mostly reduces to the masters cache.
