# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ Living documentation contract (READ FIRST, applies every session)

myHealth is an **evolving project**. These three documents are the source of truth and **must be kept current as the project grows**:

- `README.md` — user-facing overview, status, feature summary, layout.
- `CLAUDE.md` — this file: agent guidance, architecture, constraints, conventions.
- `docs/PRODUCT_FEATURES.md` and `docs/PLAN.md` — the product + plan specs.
- `docs/SHARED_CORE.md` — how this app relates to the shared cross-app core package.

**The rule:** whenever you complete a **major feature add or an architectural change**, you MUST, in the *same* piece of work, update the affected docs above before considering the task done. "Major" = a new top-level feature/page/module, a new migration set, a new subsystem (e.g. the import sidecar), a new gate/tier, a new master/OTA bundle type, or any change that makes the existing docs inaccurate.

Concretely, on each major change:
1. Update `CLAUDE.md` — add/adjust the relevant architecture section, the migration count, the data-model sketch, and the "current state" line below.
2. Update `README.md` — feature list, status, and roadmap if the phase advanced.
3. Update `docs/PLAN.md` (roadmap/data-model) and `docs/PRODUCT_FEATURES.md` (feature catalog) if scope shifted.
4. Mention the doc updates in your summary so they're visible in review.

Do **not** treat docs as optional cleanup. A feature is not "done" until the docs describe it. If a change is small/mechanical (a bugfix, a rename, a style tweak), no doc update is needed — use judgement.

**Current state:** _Phase 0 scaffold + most of Phase 1 landed._ Tauri+React+TS app wired to `sharedcorelib` (vault, tiers, gating, reminders sweep, env, ui, common masters). Migrations 0001–0006. Working: **Today** (water + daily tasks), **Profiles** (self+family), **Vitals** logging, **Goals** (with deterministic ETA projection — `domain/goals.ts`), **Journey** (tier ladder), the progressive-disclosure shell (Open/Nudge/Hidden + `FeatureGuard`), and the **habit reminder sweep** (`lib/reminderSweep.ts` → one OS notification per sweep for water/tasks due, fired on idle from `App.tsx`). `npm run build` + `npm run test` (7 tests) are green. Not yet built: medications/schedule/trends/import/directory pages (gated placeholders), OTA masters, document vault UI, ICE card, the import pipeline. Update this line as phases land (see `docs/PLAN.md` §6).

---

## Project summary

A private, offline, **client-only** family health companion. Build profiles + goals for self & family, track metrics/vitals, and import medical documents (prescriptions + lab reports) via a local CPU pipeline.

**Independence:** myHealth is **fully standalone** — it must build and run without any other app installed. It is one of a family of independent local-first apps that *optionally* share a common substrate package (`sharedcorelib`); it does **not** depend on myFinance or any sibling app. See `docs/SHARED_CORE.md`. Read `docs/PRODUCT_FEATURES.md`, `docs/PLAN.md`, and `docs/SHARED_CORE.md` before making architectural decisions.

## Hard constraints (do not violate without owner sign-off)

- **Client-only, no backend, no web target.** All data on-device (SQLite + encrypted vault).
- **Receive-only network.** Pull signed public reference data only; upload nothing. No analytics, no phone-home.
- **No medical interpretation** — extract / record / trend / remind only. No diagnosis, advice, or drug-interaction checking. Disclaimers on any interpretive-looking surface.
- **No cloud LLM; no LLM in product logic.** Everything deterministic. The *only* ML is small, **local, CPU** OCR models in the import pipeline — **never authority**; drug name, dosage, and lab values from non-native-text sources are **confirm-required** (human-in-the-loop).
- **Append-only migrations.** Never edit a shipped migration.
- **Gated master content is double-gated** — visible only when the user's tier is reached **AND** the owner has published a signed bundle. No locked teaser before data exists.
- **Progressive disclosure is mandatory.** Newcomers see a calm, small app (Starter tier). Features are **Open / Nudge (shown-locked with a one-line CTA) / Hidden (not rendered until a tier)**. Tier ladder: 🌱 Starter → 📈 Tracker → 🧭 Caretaker → 🏆 Champion (+ grant tiers 💗 Supporter, ✅ Verified Pro). The ladder is app-defined config on the shared tier engine; unlock signals are **local-only** telemetry. See `docs/PRODUCT_FEATURES.md` §4.J and §6. Do not surface advanced features to a Starter user.
- **Shared-core install is refcounted, with a standalone fallback.** Heavy runtime assets (OCR sidecar/models, OTA masters cache) install once into a shared per-user suite dir and are reused by sibling apps; the app must still run from its **own bundled copy** if the shared dir is absent. Removing one app must never break another. Never share the vault, DB, or settings. See `docs/SHARED_CORE.md` §7.

## Planned technology (shared local-first stack — see `docs/PLAN.md` §1)

Tauri v2 (Rust shell) + React 18 + TypeScript + Vite · HashRouter · Zustand · TanStack Query · Tailwind + shadcn/ui · SQLite (`tauri-plugin-sql`, `sqlite:myhealth.db`) · Stronghold vault + per-device DEK + AES-256-GCM doc blobs · Ed25519-signed/AES-GCM OTA masters from GitHub Releases · `tauri-plugin-notification` reminders · optional LAN device sync · path alias `@/` → `src/`.

**The one net-new, app-specific subsystem is the document-import pipeline** (`docs/medical-document-parser-architecture.md`), likely a bundled local OCR sidecar — decision pending (see `docs/PLAN.md` §4). Everything else is shared-core (`docs/SHARED_CORE.md`).

## Architecture (scaffold landed — keep in sync as modules land)

> The skeleton below now exists and builds. Sections marked _(later)_ are stubs/placeholders pending their roadmap phase.

- `src-tauri/` — Rust shell: `lib.rs` registers plugins + embeds numbered migrations; `capabilities/default.json` is the permission allowlist; possible parser-sidecar bridge.
- `src/pages/` — Today (daily tasks + water), Profiles, Goals, Metrics, Schedule, Import, Medications, Vault, Timeline, Immunizations, Directory (gated), etc.
- `src/domain/` — **pure** deterministic logic (goal projection, trend/range flagging, vaccine/screening schedules, care-plan templates, ICE). No DB, no React.
- `src/db/` — typed wrappers over migration SQL (`client.ts` lazily opens the DB; `getDb()` throws outside Tauri — gate with `isTauri()`).
- `src/import/` — capture quality gate, confidence-tiered review UI, field→data mapping, correction logging.
- `src/vault/` — Stronghold + document crypto (ported from myFinance).
- `src/masters/` — registry + OTA + verify (ported); new bundle types: providers directory, health-items catalog.
- `src/stores/` — settings, profiles, tier, gating (Zustand).
- `src/lib/` — environment, tiers/gamification, gating, notify, report export.

## Shared-core map (consume from `sharedcorelib`, don't reinvent)

Vault & doc crypto · masters/OTA · tiers & feature-gating · reminders (derived + manual + OS notifications) · report/PDF export · ICE/emergency · LAN sync · UI primitives. These are app-agnostic mechanisms parameterized by app-supplied config (dependency injection). See `docs/PLAN.md` §5 and `docs/SHARED_CORE.md`. If the shared package isn't available yet, implement in-app and extract later — **never** add a runtime dependency on a sibling app.

## Commands

`npm run dev` (Vite browser, no DB/vault), `npm run tauri:dev` (full app — required for SQLite/Stronghold), `npm run build` (runs `prebuild` = builds `../sharedCoreLib`, then tsc --noEmit + Vite), `npm run tauri:build`, `npm run test` (Vitest, `*.test.ts` colocated). The frontend currently builds green via `npm run build`.

## Related context

- The shared substrate (and its DI/config contract) is described in `docs/SHARED_CORE.md`. The proven precedent for this extraction style is the `@mydemo/core` package (a demo rig extracted into a standalone `file:../` package with injected config) — the shared core follows the same dependency-injection discipline.
- myHealth is **independent**: do not introduce build/runtime coupling to myFinance. Cross-app interop (if any) is **file-based and optional** (e.g. exporting a summary another app can import), never a code dependency.
