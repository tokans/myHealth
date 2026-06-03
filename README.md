# myHealth

> Your family's health record, kept by you, on your device — never in anyone's cloud.

myHealth is a **private, offline, family health companion**. It lets you build and maintain a structured health record for **yourself and your family members**, set and track **health goals**, and **import medical documents** (prescriptions and lab/pathology reports) so the data that today lives in a shoebox of PDFs and paper becomes searchable, trended, and ready to hand to a doctor.

It is a **fully standalone** app — you can install it on its own. It is also one of a family of independent local-first apps that *optionally* share a common substrate package (vault, masters/OTA, tiers, reminders, sync, exports). myHealth does **not** depend on any sibling app; the shared package is reusable infrastructure, not a cross-app dependency. See [`docs/SHARED_CORE.md`](docs/SHARED_CORE.md).

Architecturally it is a client-only Tauri v2 + React/TypeScript app with **no backend**, an encrypted on-device vault, gated reference data delivered over-the-air (receive-only), and a usage-tier model.

## Status

🟡 **Planning / pre-implementation.** No application code yet. The design is captured in:

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

- **Health profiles** for self + family (the backbone)
- **Goals & tracking** with deterministic projections
- **Metrics & vitals** time-series with reference-range flagging
- **Document import** — native-text PDFs skip the wizard; scans/photos/handwriting go through a confidence-tiered, human-in-the-loop review
- **Medications & reminders**, **immunizations & screenings**, **encrypted document vault**, **medical ICE card**, **doctor-visit summary export**
- **Gated reference data** (professionals directory, health-items catalog) — visible only at a usage tier *and* once published

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
```

_Code directories (`src/`, `src-tauri/`) will appear as implementation begins._
