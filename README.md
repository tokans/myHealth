# myHealth

> Your family's health record, kept by you, on your device — never in anyone's cloud.

myHealth is a **private, offline, family health companion**. It lets you build and maintain a structured health record for **yourself and your family members**, set and track **health goals**, and **import medical documents** (prescriptions and lab/pathology reports) so the data that today lives in a shoebox of PDFs and paper becomes searchable, trended, and ready to hand to a doctor.

It is a **fully standalone** app — you can install it on its own. It is also one of a family of independent local-first apps that *optionally* share a common substrate package (vault, masters/OTA, tiers, reminders, sync, exports). myHealth does **not** depend on any sibling app; the shared package is reusable infrastructure, not a cross-app dependency. See [`docs/SHARED_CORE.md`](docs/SHARED_CORE.md).

Architecturally it is a client-only Tauri v2 + React/TypeScript app with **no backend**, an encrypted on-device vault, gated reference data delivered over-the-air (receive-only), and a usage-tier model.

## Status

🟢 **Phase 1 complete.** A Tauri v2 + React + TS app, wired to `sharedcorelib`, builds green (`npm run build`, 11 tests). Working: **Today** (water + daily tasks), **Profiles** (self + family), **Vitals**, **Goals** (with ETA projection), **Reminders** inbox, **Schedule**, **Medications**, an encrypted **Document vault**, a printable **Medical ICE card** + **doctor-visit summary**, and **Your journey** (the tier ladder) — all behind the progressive-disclosure shell, each feature surfacing only at its tier. Next up is Phase 2, the medical-document import pipeline. The design is captured in:

- [`docs/PRODUCT_FEATURES.md`](docs/PRODUCT_FEATURES.md) — what we're building and why.
- [`docs/PLAN.md`](docs/PLAN.md) — architecture, data model, and the phased delivery plan.
- [`docs/medical-document-parser-architecture.md`](docs/medical-document-parser-architecture.md) — the local, CPU-only document-import pipeline (prescriptions + lab reports).

## Principles (hard constraints)

- **Client-only, no backend, no web target.** Data lives only on your device.
- **Receive-only network.** The app *pulls* signed public reference data and *uploads nothing*. No analytics, no phone-home.
- **No medical interpretation.** myHealth extracts, records, trends, and reminds — it does **not** diagnose, advise, or check drug interactions.
- **No cloud LLM; no LLM in product logic.** All math and checklists are deterministic. The only ML is small, local OCR models used as an import *assist* — never as authority, with human confirmation on safety-critical fields.
- **Privacy is the feature.** Local-only handling of medical documents is the point.

## Core features (see the product doc for the full catalog)

- **Daily habits** — a calm **Today** view (small task checklist), **water intake + reminders**, custom daily tasks, and a daily/weekly **schedule**
- **Health profiles** for self + family (the backbone), with a one-tap **active-profile switcher** that re-scopes every page (a top-right profile drawer on mobile)
- **Goals & tracking** with deterministic projections
- **Metrics & vitals** time-series with reference-range flagging
- **Document import** — native-text PDFs skip the wizard; scans/photos/handwriting go through a confidence-tiered, human-in-the-loop review
- **Medications & reminders**, **immunizations & screenings**, **encrypted document vault**, **medical ICE card**, **doctor-visit summary export**
- **Shared emergency card** — the medical ICE card lives in a common suite table, so the same emergency contact stays in sync across your Tokans apps (e.g. myFinance) without ever duplicating it
- **Report an issue** straight to GitHub, and a **"Supported by Tokans.org"** attribution in the status bar (shared-core)
- **Gated reference data** (professionals directory, health-items catalog) — visible only at a usage tier *and* once published

### Designed not to overwhelm
New users land in a small, **water-first Starter** app — just Today (water + tasks), Vitals, Reminders, Profiles, and your Journey. Everything heavier (goals, schedule, trends, medications, document vault) stays **Hidden** until you reach **Tracker**, with one exception: **importing medical documents** is shown-locked as a gentle **Nudge** so you can see where the ladder leads. On phones the bottom bar stays deliberately tiny — **Today, Vitals, and More** — with profiles (add/switch) plus the Report-an-issue and Supported-by actions tucked into the top-right profile drawer, and everything else under **More**. Features unlock as you use it, along a health-flavored ladder — **🌱 Starter → 📈 Tracker → 🧭 Caretaker → 🏆 Champion** (plus grant tiers Supporter & Verified Pro). Each feature is **Open**, a **Nudge** (shown-locked with a one-line CTA), or **Hidden** until earned. All unlock signals are computed **on-device** and never transmitted.

## Roadmap (high level)

0. Scaffold → 1. Manual-data core app → 2. Tractable import (lab reports + printed Rx) → 3. Handwriting & hard pages → 4. Gated reference data → 5. Breadth & device sync → 6. Improvement loop.

Details in [`docs/PLAN.md`](docs/PLAN.md).

## Project layout

```
myHealth/
├─ README.md               ← you are here
├─ CLAUDE.md               ← guidance for Claude Code (living-doc contract + constraints)
├─ EXTRACTION_PROMPT.txt   ← paste into a myFinance session to build the shared core
└─ docs/
   ├─ PRODUCT_FEATURES.md
   ├─ PLAN.md
   ├─ SHARED_CORE.md        ← shared cross-app package + installer/runtime-sharing design
   └─ medical-document-parser-architecture.md
├─ src/                   ← React + TS frontend (pages, components, db, stores, domain)
└─ src-tauri/             ← Rust shell, migrations, capabilities, core_bootstrap.rs
```

Run `npm install` then `npm run tauri:dev` for the full app (SQLite + vault), or `npm run dev` for a browser preview (no DB).
