# Shared core — cross-app strategy

**Status:** Strategy doc (v0.1)
**Audience:** anyone building this family of apps (myFinance, myHealth, and future ones).

This doc explains how myHealth (and siblings) **stay independent yet share code**, and gives a **ready-to-run prompt** (§6) you can paste into a *myFinance* session to extract the common substrate — without myHealth and myFinance ever depending on each other.

---

## 1. The problem

You're building several **local-first, client-only Tauri+React apps** (myFinance, myHealth, more to come) and giving them to others. Any given user may install **one, some, or all** of them. So:

- **Each app must stand completely alone** — build, run, and ship with no sibling installed.
- **But** the same plumbing (encrypted vault, OTA masters, tiers, reminders, LAN sync, PDF export, UI kit) shouldn't be hand-maintained in N copies that drift apart.

The answer is **not** "myHealth imports from myFinance." That couples two shippable products. The answer is a **third thing**: a standalone, app-agnostic **shared core package** that every app consumes the same way.

## 2. The model: standalone apps + one shared core

```
        ┌─────────────────────────────┐
        │  sharedcorelib  (library)  │   ← app-agnostic mechanisms, DI config,
        │  c:\workspace\sharedCoreLib      │     NO app-specific knowledge, ships nothing
        └─────────────┬───────────────┘
              file:../sharedCoreLib (local dep)
        ┌─────────────┼───────────────┬───────────────┐
        ▼             ▼               ▼               ▼
   myFinance      myHealth        myFuture-app    …each is a standalone product
```

- **`sharedcorelib`** is a *library*, not an app. It has no DB of its own, no pages, no branding — only reusable mechanisms parameterized by **injected config**.
- Each app depends on the core via a local path dependency (`"sharedcorelib": "file:../sharedCoreLib"`), exactly like the existing **`@mydemo/core`** precedent (the demo rig already extracted to `c:\workspace\myDemo` and consumed via `file:../myDemo` with an injected `DemoConfig`). Same discipline, different domain.
- **Apps never depend on each other.** If two apps want to interoperate, they do it through **optional, file-based, one-directional** exports (e.g. myHealth writes a medical-expense file myFinance *can* import) — never a code dependency, and only when both happen to be installed.

> Suggested names are placeholders — rename `sharedcorelib` / `c:\workspace\sharedCoreLib` to your taste (e.g. `@mykit/core`, `myCommon`). Keep the `file:../` + DI pattern.

## 3. Non-negotiable principles

1. **Standalone-first.** An app must build & run with the core absent-from-knowledge — the core knows nothing app-specific. All app specifics arrive as **config/adapters**.
2. **Dependency injection, no singletons.** Every core function takes a resolved config object (the `@mydemo/core` lesson). No module-level config, no global state. This is what lets two apps use the same code with different salts, repos, schemas.
3. **Extract, don't fork.** When an app needs a tweak to a shared mechanism, generalize it in the core (add a config knob) — don't copy-paste a divergent version.
4. **App owns its data & domain.** Schema (migration SQL content), domain logic, pages, master registries, branding, disclaimers, and the import pipelines stay in each app.
5. **Per-app secrets stay per-app.** The vault's **Argon2 salt/params are per-app and must never change for an existing app** (changing them bricks users' vaults). The core takes them as config; each app passes its own constant.

## 4. What is shared vs app-specific

| Shared core (mechanism, app-agnostic) | App-specific (stays in each app) |
|---|---|
| Stronghold vault wrapper, per-device DEK, AES-256-GCM doc blobs | The vault's **salt/params** (config), what docs mean |
| Masters/OTA engine: Ed25519 verify, AES-GCM transport, monotonic revision, 4-layer merge, GitHub-Releases pull | The **master registry** + zod schemas + which bundle types exist |
| Tiers/gamification + launch telemetry | Tier thresholds, the "core feature" set |
| Feature-gate framework + `FeatureGuard` + gating store | The **gate definitions** & prerequisites |
| **Content library framework** (`sharedcorelib/content`): model + helpers, OTA payload schemas, `createContentStore`, `createContentSync` (daily catalog + per-type bundle sync), registry merge, **and an arbitrary-depth content-TREE reader** (`buildContentTree`/`buildContentTreeFromGlob` + property-file parsing) | The `content/<type>/…` folders (baked samples + `bundles/*.json` + any nested property/leaf files), the `import.meta.glob`, the icon resolver, the page UI + nav wiring, the release tags + signing keys |
| Reminder engine: derived+manual, sweep, bucketing, one-notification-per-sweep | The **derived-reminder generators** (from app data) |
| LAN sync transport (Rust pipe) + envelope crypto + LWW merge | The **sync adapter**: which tables, change-set schema |
| HTML→PDF report harness; PBKDF2→AES-GCM export packaging | The **report templates** |
| ICE/emergency contact-extraction primitives **+ the common `IceCard` table & `createIceStore`** (a shared suite-DB row-set both apps read/edit) | The ICE fields/copy; which person keys to sync |
| Shared **suite DB** + semantic **schema registry** (`sharedcorelib/db` + `/schema`): one `suite.db` with per-app + `owner:"common"` tables, governed by confidentiality | App schema descriptors; the Rust `shared_core_db_path` path |
| UI kit: shadcn/ui primitives, `AppShell`, `FiniteSetInput`, forms, environment helper (`isTauri`) | Nav config, theme, copy, pages |
| (Stretch) a shared **Rust crate** for plugin registration + `sync.rs` byte-pipe | Migration SQL files, `lib.rs` wiring |

**Cross-language note:** the TS side extracts cleanly into an npm package. The Rust side (`sync.rs`, plugin registration) is harder to package; treat a shared Rust crate as a *stretch goal* — initially each app may keep a thin `src-tauri` that the core's docs describe how to wire.

## 5. How a new app adopts the core

1. Add `"sharedcorelib": "file:../sharedCoreLib"` to `package.json`.
2. Write one `appConfig` object (app name, db name, vault salt/params, OTA repo+keys, tier thresholds, gate defs, master registry, reminder generators, sync adapter, nav).
3. Call core factories with that config; implement only app-specific domain + pages + migrations + import.
4. The app builds and runs standalone — the core is just a library on disk.

## 6. ▶ Prompt to run **inside myFinance** to create the shared core

Open a Claude Code session in `C:\workspace\myFinance` and paste the block below. It extracts the common substrate into a new standalone package and rewires myFinance to consume it — **leaving myFinance fully working and standalone**, and producing a package myHealth/future apps can consume identically. (It does **not** touch myHealth.)

```text
We are extracting myFinance's app-agnostic infrastructure into a new STANDALONE shared
package so that a family of independent local-first apps (myFinance, myHealth, and future
ones) can reuse it WITHOUT depending on each other. Follow the exact precedent of the
existing @mydemo/core extraction (standalone repo, consumed via file:../, dependency-
injected config object, NO module-level singletons).

Read first:
- This repo's CLAUDE.md.
- The memories under ~/.claude/projects/c--workspace-myFinance/memory/ — especially the
  stack, finite-set/masters, gamification/tiers, device-sync, and the @mydemo/core
  extraction memory (project_demo_rig_extracted.md). Mirror that extraction's style.

Goal:
- Create a new standalone package at C:\workspace\sharedCoreLib named "sharedcorelib" (rename
  if you prefer; keep file:../ + DI). It is a LIBRARY: no app DB, no pages, no branding —
  only reusable mechanisms parameterized by an injected config object. It must not import
  anything app-specific from myFinance.
- Consume it from myFinance via "sharedcorelib": "file:../sharedCoreLib", passing myFinance's
  config in. myFinance must remain fully working and fully standalone afterwards.

Extract these subsystems as app-agnostic, config-injected modules (subpath exports like
sharedcorelib/vault, /masters, /tiers, /gating, /reminders, /sync, /report, /ice, /ui,
/env). For EACH, the mechanism is shared; app specifics become config/adapters:
  1. env helpers (isTauri, paths)                         — fully generic.
  2. packageCrypto (PBKDF2 -> AES-GCM export sealing)     — fully generic.
  3. vault: Stronghold wrapper + per-device DEK + AES-256-GCM doc blobs.
       CRITICAL: the Argon2 salt/params are PER-APP and must stay EXACTLY myFinance's
       current constant values — pass them via config; DO NOT change them (changing the
       salt bricks existing users' vaults). Add a clear comment to that effect.
  4. masters/OTA engine: Ed25519 verify, AES-GCM transport, monotonic-revision anti-
       downgrade, 4-layer merge, GitHub-Releases pull, custom/master option tables.
       App supplies: release repo/tag, signing public key, transport key, its OWN master
       registry + zod schemas, and which bundle types exist (e.g. partners).
  5. tiers/gamification + launch telemetry. App supplies an ORDERED tier ladder (N tiers,
       each with a local unlock predicate) + grant tiers + core-feature set. Do NOT hardcode
       a 3-tier ladder — myFinance has 3 earned tiers, but other apps (e.g. myHealth) define 4.
  6. feature-gating framework + FeatureGuard + gating store. App supplies gate defs.
  7. reminders: derived+manual model, sweep, bucketing, one OS notification per sweep,
       snooze/dismiss preservation. App supplies the derived-reminder GENERATORS.
  8. report: HTML->PDF harness. App supplies templates.
  9. ice/emergency: contact-extraction + ICE-card primitives. App supplies fields.
 10. ui: shadcn/ui primitives, AppShell (sidebar/bottom-tab), FiniteSetInput, common forms.
       App supplies nav config + theme.
 11. (Stretch, only if clean) a shared Rust crate for plugin registration + sync.rs byte-
       pipe. If it isn't clean, SKIP it and document how each app wires src-tauri instead.

Installer / runtime sharing (so the FIRST suite app installs the core and a SECOND app
REUSES it, while each app still installs and runs STANDALONE):
 12. Treat "core" as two layers. L1 = the build-time TS/React library: it is bundled into
     each app's webview bundle (do NOT try to runtime-share compiled JS). L2 = heavy
     runtime assets worth sharing: native sidecars/models (if any) and the OTA masters
     download cache. Implement L2 sharing:
     - Define a per-user (no-admin) shared suite dir with a manifest.json holding
       { coreVersion, owners[] }:
         Windows %LOCALAPPDATA%\SharedCoreLib\core ; macOS ~/Library/Application Support/
         SharedCoreLib/core ; Linux ~/.local/share/SharedCoreLib/core.
     - Add a startup bootstrap (Rust, in lib.rs setup — portable across installers): if the
       shared dir is absent OR manifest.coreVersion < the version this app bundles, lay down
       / upgrade L2 from the app's bundled copy and bump the version; else REUSE and install
       nothing. Register this app's id in owners[] (idempotent).
     - STANDALONE GUARANTEE: if the shared dir is missing/unwritable at runtime, fall back
       to the app's own bundled copy so an app installed alone always works.
     - Uninstall hook: remove this app's id from owners[]; delete the shared dir only when
       owners[] is empty (so removing one app never breaks another).
     - Inject the masters OTA cache path = <shared dir>/masters so the FIRST app to pull
       downloads and the SECOND reuses the cache (each app still applies only the master
       types it registers into its OWN SQLite). The masters storage path MUST be config-
       injected (this falls out of the DI work above).
     - Versioning: backward-compatible within a major (apps require coreMajor==N &&
       coreMinor>=m); a newer app upgrades the shared core in place; a breaking change uses
       a versioned subdir (core/v2) so majors coexist.
     - NEVER share user data: vaults (per-app salt), app SQLite DBs, and settings stay
       strictly per-app and isolated. Only the L2 redistributable assets are shared.
     - Wire myFinance as the "first app" that lays down the core, and document the whole
       install/reuse/refcount/version contract in sharedCoreLib/CONTRACT.md so myHealth and
       future apps reuse it identically.

Hard rules:
- Dependency injection only: every exported function/factory takes a resolved config; no
  module-level config, no global mutable state. Match @mydemo/core's DI style.
- The package must NOT know about finance OR health concepts. If something is app-specific,
  it stays in the app and is passed in.
- Preserve all existing hard constraints (receive-only network, no LLM in product logic,
  append-only migrations, per-app vault salt).

Process (incremental, keep the build green the whole way):
- Scaffold C:\workspace\sharedCoreLib (its own git repo, package.json, tsconfig, subpath
  exports, README, and a CONTRACT.md documenting the public API + the required app-config
  shape so myHealth/future apps can consume it identically).
- Extract ONE subsystem at a time, starting with the most clearly-generic (env,
  packageCrypto, vault) before the config-heavy ones (masters, sync). After each: update
  myFinance to import from sharedcorelib, then run `npm run build` (tsc --noEmit + Vite)
  and `npm run test` (Vitest) and confirm green before moving on.
- Do not delete myFinance's original module until its replacement import is green.

Finish by:
- Updating myFinance's CLAUDE.md to describe that infra now comes from sharedcorelib, and
  adding a memory file (like project_demo_rig_extracted.md) recording the extraction and
  the package's config contract.
- Writing sharedCoreLib/CONTRACT.md as the canonical "how an app consumes the core" reference.
- Summarizing exactly which modules were extracted, the app-config shape, and any
  subsystem you intentionally left in-app (e.g. the Rust crate) with the reason.

Do NOT modify anything under C:\workspace\myHealth. This task is only myFinance + the new
C:\workspace\sharedCoreLib package.
```

After that runs, point myHealth at the same package: add `"sharedcorelib": "file:../sharedCoreLib"` and follow `sharedCoreLib/CONTRACT.md` (this is Phase 0/1 work in [`PLAN.md`](./PLAN.md)).

## 7. Installer & runtime sharing — *first app installs the core, second reuses it*

> Your requirement: when a user installs the **first** app from the suite, its installer lays down the shared core; when they install a **second**, it **reuses** what's already there instead of re-installing/re-downloading — while each app still installs and runs **standalone**.

### 7.1 Two layers of "core" — only one is worth runtime-sharing

| Layer | What it is | Size | Sharing |
|---|---|---|---|
| **L1 — build-time library** | the TS/React `sharedcorelib` code | small (KB–low MB) | **Bundled into each app's webview bundle** at build time. Not runtime-shared (it's compiled into each app's assets). Duplication here is cheap and keeps apps standalone. |
| **L2 — runtime assets** | native sidecars + ML models (e.g. myHealth's OCR sidecar), the **OTA reference-data cache** (masters/partners bundles), and a suite manifest | large (10s–100s MB) + downloaded | **Installed once into a shared suite dir and reused.** This is "the core" worth sharing. |

So "first installs the core, second reuses it" applies to **L2** — the expensive, downloaded, native stuff. The cheap compiled library rides along in each app.

### 7.2 Shared suite directory (per-user, no admin)

```
Windows : %LOCALAPPDATA%\SharedCoreLib\core\
macOS   : ~/Library/Application Support/SharedCoreLib/core/
Linux   : ~/.local/share/SharedCoreLib/core/
   ├─ manifest.json     # { coreVersion, owners: ["myFinance","myHealth"], ... }
   ├─ bin/              # shared native sidecars (e.g. the OCR parser)
   ├─ models/           # shared ML models
   └─ masters/          # shared OTA reference-data cache (downloaded once, reused)
```

### 7.3 Install / reuse flow (offline, refcounted, standalone-safe)

Each app **bundles** its required L2 payload as an installer resource, then a small **startup bootstrap** (Rust, in `lib.rs` setup — most portable across all installers/platforms) does:

1. **Lay-down-or-reuse:** if the shared dir is absent **or** `manifest.coreVersion < this app's bundled version` → lay down / upgrade L2 from the bundled copy and bump the version. If `manifest.coreVersion >= bundled` → **reuse, install nothing**.
2. **Refcount:** add this app's id to `manifest.owners[]` (idempotent).
3. **Standalone fallback:** if the shared dir is ever missing/unwritable at runtime, the app uses its **own bundled copy** — so an app installed alone always works.

**Uninstall** (installer uninstall hook): remove this app's id from `owners[]`; delete the shared dir **only when `owners[]` is empty**. So removing one app never breaks another.

### 7.4 The cleanest win: shared OTA masters cache

Point the masters engine's download-cache path at `…/core/masters` (the path is **config-injected**, so each app just passes the shared one). The **first** app to run an OTA pull downloads the signed bundle; the **second** app reads the same cache and **reuses** it — no second download. Each app still applies only the master *types it registers* into its **own** SQLite `master_options`. (The downloaded bytes are shared; the materialized per-app tables are not.)

### 7.5 Versioning

Shared core is **backward-compatible within a major**; apps require `coreMajor == N && coreMinor >= m`. A newer app **upgrades the shared core in place**; older apps keep working. A breaking change uses a **versioned subdir** (`core/v2/`) so majors coexist and each app picks its own.

### 7.6 What is **never** shared (security & independence)

Vaults (per-app Argon2 salt), app SQLite DBs, and app settings stay **strictly per-app and isolated**. Only the redistributable L2 assets above are shared.

---

## 8. If you only ever build myHealth

Totally fine. myHealth implements these subsystems in-app (Phase 1) and you simply never extract them. The shared core is an **optimization for when you have 2+ apps**, not a prerequisite. Nothing in myHealth's plan blocks on it.
