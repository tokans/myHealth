# Demo capture rig

Regenerate the README/marketing GIFs and videos by driving the **real** myHealth
app through real user interactions and recording the window. This is **dev
tooling** — none of it ships. Product code is only touched behind
`VITE_DEMO_MODE` (see `src/lib/demoMode.ts`), so production builds are unaffected.

The reusable engine lives in the shared **`@mydemo/core`** package
(`file:../myDemo`, an **optional** dependency); this repo supplies only the thin
`demo/` layer — app identity/config (`demo/config.ts`) and the scenarios
(`demo/scenarios/`). Everything else (launch, capture, encode, compose) is the
package's job.

> **Run it yourself, in an interactive desktop session.** The rig opens a real
> app window and screen-records it. It will not work headless / over a
> non-interactive remote session, and it is **not** launched from CI.

---

## Prerequisites

Five external tools (the rig augments `PATH` for child processes, but they must
be installed):

| Tool | What for | Install (Windows) | macOS | Linux |
|------|----------|-------------------|-------|-------|
| **Node 20+** | runs the rig (tsx) | bundled with the repo toolchain | `brew install node` | distro pkg |
| **Rust + cargo** | builds the Tauri binary; installs the cargo tools below | <https://rustup.rs> | rustup | rustup |
| **ffmpeg** | screen capture + transcode | `winget install Gyan.FFmpeg` | `brew install ffmpeg` | `apt install ffmpeg` |
| **gifski** | MP4/Y4M → GIF | `cargo install gifski` | `cargo install gifski` | `cargo install gifski` |
| **tauri-driver** | WebDriver bridge for Tauri | `cargo install tauri-driver --locked` | same | same |

Plus a **native WebView driver matched to your browser engine**, vendored under
`demo/.bin/`:

- **Windows** — `msedgedriver.exe` matching your installed Edge/WebView2 version.
  Find your version (`msedge://version`), download the matching
  `edgedriver_win64.zip` from
  <https://developer.microsoft.com/microsoft-edge/tools/webdriver/>, and extract
  `msedgedriver.exe` to `demo/.bin/`.
- **macOS/Linux** — Tauri uses WebKitWebDriver (`WebKitWebDriver` /
  `webkit2gtk-driver`); point the driver path in `demo/config.ts` at it.

The optional `@mydemo/core` sibling must be present at `../myDemo` and installed
(`npm install` from this repo picks up the `file:` optional dep). `webdriverio`
and `tsx` are dev dependencies.

---

## How to run

```powershell
# From the repo root, in your own terminal:
.\demo\run-demo.ps1                          # build + record scenario 01
.\demo\run-demo.ps1 -Scenario 02-log-vital
.\demo\run-demo.ps1 -All                     # every registered scenario
.\demo\run-demo.ps1 -GifsOnly                # re-encode existing MP4s → GIF
.\demo\run-demo.ps1 -NoBuild                 # skip the build, use current artifacts
```

The underlying cross-platform npm scripts:

```bash
npm run demo:build          # force-build demo bundle (frontend + debug binary)
npm run demo:reset          # wipe app DB + vault only
npm run demo:single -- 02-log-vital
npm run demo:all
npm run demo:gifs           # re-encode MP4s → GIF, no recording
```

Output lands in `demo/output/` (git-ignored) as `<scenario>.mp4` + `<scenario>.gif`.

---

## How it works

Per scenario: **reset app data → serve the demo `dist/` on :1420 → launch the
debug binary via tauri-driver (maximized by `--demo`) → foreground + measure the
window's client area → ffmpeg captures that region → run the scenario → stop
ffmpeg → gifski.** Each scenario runs in its **own child process** for clean
WebDriver teardown.

**Demo build flags (`demo/config.ts` → `build.frontendEnv`).** The bundle is
built with:

- `VITE_DEMO_MODE=1` — `src/lib/demoMode.ts` then makes the encrypted document
  vault **auto-unlock** with `demo1234` (`UnlockPanel.tsx`) and redirects native
  file saves to the app-data dir (`ExcelButtons.tsx`, `Documents.tsx`,
  `excelBackup.ts`) so scenarios run unattended.
- `VITE_TIER=champion` + `VITE_ALLOW_TIER_OVERRIDE=1` — opens the tier-gated
  surfaces (Goals, Trends, Medications, Documents) so they're reachable.
- `VITE_SEED=on` — seeds the deterministic demo dataset (3 profiles, 120-day
  vitals trending healthier, goals, medications, schedule) on launch. The rig
  wipes the DB before each scenario, so each starts from the same seeded state.

All of these are inert in a normal `npm run build` / `tauri build` — the shipped
binary contains no demo code (the Rust `--demo` block is `#[cfg(all(desktop,
debug_assertions))]`).

**Navigation.** myHealth's nav is the shared `SuiteShell` (no per-link
test-ids), so scenarios navigate by hash route via `h.goto("/route")` and click
in-page elements selected by `data-testid` (added to the buttons/inputs each
scenario touches — e.g. `today-add-water`, `metrics-save`, `goal-new`,
`documents-scan-insurance`).

**Adding a scenario.** Create `demo/scenarios/NN-name.ts` (default-export a
`Scenario`), register it in `demo/scenarios/index.ts`, and add any `data-testid`s
it touches to the relevant component. `data-testid` is kebab-case and scoped:
`<page>-<action>`.

---

## Scenarios

| # | id | What the GIF shows |
|---|----|--------------------|
| 01 | `01-welcome-profile` | Today (water + a daily task) → Profiles → add a family member |
| 02 | `02-log-vital` | Vitals → pick Weight → enter a value → save → recent list |
| 03 | `03-goal-eta` | Goals → new measurable goal → card with On-track + progress + ETA |
| 04 | `04-trends` | Trends → Weight (downward) → Blood pressure → reference band + summary |
| 05 | `05-schedule-reminder` | Schedule → add a block → Reminders inbox → complete one |
| 06 | `06-medication` | Medications → add Metformin 500 mg (OD) → med card |
| 07 | `07-document-scan` | Documents (vault auto-unlocks) → Scan insurance card → encrypted picker |
| 20 | `20-full-tutorial` | **Single-take tour** (`solo`, excluded from `--all`): Today→Vitals→Goals→Trends→Medications→Documents→Journey with `h.mark()` captions |

> **Scenario 07 — native file dialog.** myHealth's document picker is a **native
> OS open dialog** (no hidden `<input type=file>`), which WebDriver can't drive,
> so the scenario stops at the "Choose file" prompt. Capture the file-pick + OCR
> extraction tail by hand (see the checklist).

---

## Finished videos (post-production)

```powershell
.\demo\make-video.ps1                  # fresh record + marketing montage
.\demo\make-video.ps1 -Video tutorial  # fresh record + full tutorial
.\demo\make-video.ps1 -Video both
.\demo\make-video.ps1 -NoRecord        # re-edit from existing clips (fast)
```

- **Marketing cut (the ~60s advert)** — `demo/edit/marketing.edl.ts`: a
  declarative edit-decision list (clips sliced from each scenario MP4 with
  burned-in **lower-third captions + full-screen title cards** — the text
  overlays — bookended by an **"Now on Android, too"** beat and a privacy
  close), composed by `@mydemo/core`'s `compose()`. Every `in`/`out` is in
  source-seconds and freely editable — re-run `npm run demo:video:marketing` to
  recompose in seconds (no re-recording). The windows are tuned for a ~60s total
  but remain **starting guesses**; eyeball the payoff moment in each
  `demo/output/<id>.mp4` and adjust.

  > **Publishing to the website.** `make-video.ps1` copies the finished
  > `demo/output/video/marketing.mp4` to `.github/pages/assets/demo.mp4`. That
  > folder ships verbatim to the `gh-pages` branch on the next release, and the
  > landing page plays `assets/demo.mp4` in its "See it in action" section — so
  > just **commit `.github/pages/assets/demo.mp4`** to publish the advert. (Until
  > a video exists the page hides that section automatically.)
- **Tutorial** — the single-take `20-full-tutorial` recording, captioned from its
  `h.mark()` strings (burned in as subtitles) and scored, via
  `npm run demo:video:tutorial`.

**Music** (royalty-free, no attribution): drop a track at
`demo/assets/music/marketing.mp3` / `tutorial.mp3` and re-render with
`-NoRecord`. If a file is absent the video renders **silent** rather than
failing.

---

## Manual-recording checklist (not automated)

Record these by hand (or with OBS) and drop them in `demo/output/`:

- [ ] **Cold-start first-run** — the empty "Create my profile" welcome before any
      data exists. (The demo build seeds on launch, so the rig never shows it.)
- [ ] **Document scan tail (scenario 07)** — choosing the file in the native OS
      dialog, the OCR/field extraction, the confidence-tiered review, and saving
      into the encrypted vault.
- [ ] **Mobile pass** — run on an Android emulator / iOS device and capture the
      bottom-tab mobile layout + the heart FAB sheet (the rig is desktop-only).
- [ ] **Device-to-device sync** — needs two devices on a LAN; record the pairing
      + last-writer-wins merge by hand.
- [ ] **Content tabs (Yoga/Exercises)** + **OTA bundle download** — consume signed
      release assets; stage them and capture the in-app apply by hand.
- [ ] **Supporter/Pro grant import** (Settings) — consumes a signed `.grant` file;
      stage it and capture the unlock by hand.

---

## Notes

- **Your real data** — `demo/reset.ts` deletes the app-data DB + vault snapshot
  for the demo identity (`com.myhealth.app`). It does not touch other apps.
- **No health data egresses** — the rig only reads the screen via ffmpeg; demo
  file writes go to the app-data dir and are never uploaded. Vault blobs are
  never exported.
