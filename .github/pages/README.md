# myHealth — release README + GitHub Pages site

This folder drives the **public landing page** published to `tokans/myHealth` on
every release, right alongside the auto-generated `README.md`. Both are produced
by the **publish** job in
[`../workflows/build-release.yml`](../workflows/build-release.yml) — there is
nothing to run by hand beyond pushing a release tag.

Unlike myFinance (a private repo mirrored to a public one), **myHealth is already
public** at `tokans/myHealth`, so there is no mirror step — pushing a `v*` tag to
this repo triggers the build directly, using the built-in `GITHUB_TOKEN`.

```
git tag v1.2.3 && git push origin v1.2.3
   └─ fires .github/workflows/build-release.yml on tokans/myHealth
        ├─ build native installers (Win / macOS) + experimental mobile
        ├─ publish a GitHub Release on tokans/myHealth
        ├─ rewrite README.md on tokans/myHealth          (default branch)
        └─ publish the landing page to the gh-pages branch  ← this folder
```

(You can also trigger it from the Actions tab via **workflow_dispatch** with a
version input.)

## Files in this folder

| File | Purpose |
| --- | --- |
| `index.template.html` | The landing page. **Edit this to redesign the site.** Tokens `__VERSION__`, `__REPO__`, `__RELEASE_URL__`, `__LATEST_URL__` are substituted at publish time. |
| `serve.py` | Loopback static server used by `preview.bat` (auto-picks a free port). |
| `preview.bat` | Renders the template with sample values and serves it locally so you can design it. |
| `sample-release-notes.md` | Stand-in release notes used only by `preview.bat`. |
| `.gitignore` | Ignores `.preview/` (the local render output). |

The release notes are **not** baked into the HTML: the page `fetch()`es a
sibling `release-notes.md` (written by the workflow from GitHub's auto-generated
notes) and renders it client-side with marked.js. That keeps arbitrary markdown
out of the HTML and means the notes update every release.

---

## One-time setup

1. **Run one release** — push a `v0.1.0` tag (or run the workflow_dispatch). The
   publish job uses the built-in `GITHUB_TOKEN` (it has `contents: write`), so no
   extra PAT is needed for the Release/README/Pages pushes. The workflow creates
   the `gh-pages` branch the first time it runs.
   - (The separate `security.yml` workflow does need a `PUBLISH_TOKEN` PAT to
     check out the private/cross-repo `sharedCoreLib` — that's unrelated to Pages.)
2. **Enable Pages** on `tokans/myHealth` (once, after step 1 created the branch):
   - Repo → **Settings → Pages**
   - **Build and deployment → Source:** *Deploy from a branch*
   - **Branch:** `gh-pages`  •  **Folder:** `/ (root)` → **Save**
3. Wait ~1 minute. The site is live at **https://tokans.github.io/myHealth/**.

After that, every release refreshes both the README and the site automatically.

### (Optional) custom domain

To serve at e.g. `myhealth.app`, add a `CNAME` file (containing just the domain)
to the `gh-pages` branch and point your DNS at GitHub Pages. The workflow clones
the existing branch before republishing, so a `CNAME` you add manually
**survives** future releases.

---

## Designing the landing page

1. Edit [`index.template.html`](index.template.html) — a single self-contained
   file (inline CSS + a little JS), no build step.
2. Double-click **`preview.bat`** (or run it). It copies the template to
   `.preview/index.html` substituting sample values, drops
   `sample-release-notes.md` next to it, copies `assets/` (if present), and
   serves at **http://localhost:8000/**.
3. Tweak, save, refresh. Repeat.

> A local HTTP server is required — the page fetches `release-notes.md`, and
> `fetch()` is blocked on `file://`. `preview.bat` uses `serve.py`, which binds
> to loopback and auto-picks a free port. Force a port with `preview.bat 5500`.

**Keep the four tokens spelled exactly** (`__VERSION__`, `__REPO__`,
`__RELEASE_URL__`, `__LATEST_URL__`) — the workflow replaces them with `sed`.

### Demo video

The **"See it in action"** section plays `assets/demo.mp4` (autoplay, muted,
looping, with controls). **If the video fails to load, the whole section hides
itself** — so the page stays clean even before any demo is recorded.

There is **no `assets/demo.mp4` committed yet.** Once you record a montage with
the demo rig (see [`../../DEMO.md`](../../DEMO.md)), copy a clip in and commit it
(~1 MB; it lives in git):

```bat
copy /y demo\output\video\marketing.mp4 .github\pages\assets\demo.mp4
```

The release workflow copies the whole `.github/pages/assets/` folder into the
published site on every release, so the video then ships automatically.

---

## How the workflow builds the site (reference)

In the `publish` job of
[`../workflows/build-release.yml`](../workflows/build-release.yml), the
**"Update GitHub Pages site"** step:

1. Reads this release's auto-generated notes via `gh release view`.
2. Clones the `gh-pages` branch of `tokans/myHealth` (creating it as an orphan
   branch the first time), preserving any `assets/`, `CNAME`, etc.
3. Writes the notes to `release-notes.md` and touches `.nojekyll`.
4. Copies `.github/pages/assets/` (incl. `demo.mp4`, if present) into the site.
5. `sed`-substitutes the tokens in `index.template.html` into `index.html`.
6. Commits and pushes to `gh-pages`.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Site 404s after first release | Pages not enabled yet — do the one-time **Settings → Pages** toggle (branch `gh-pages`, root). |
| "What's new" shows the fallback link, not notes | `release-notes.md` failed to load. Confirm it exists on `gh-pages`; on a real release confirm `gh release view` returned a body. |
| Demo section missing | Expected until `assets/demo.mp4` is committed — the section auto-hides when the file 404s. |
| Pages step fails to push | The publish job's `GITHUB_TOKEN` needs `contents: write` (it's declared in the job's `permissions`). |
| Custom domain reverts | Ensure `CNAME` is committed on `gh-pages` (the workflow preserves it; it can't create one it never saw). |
| Local preview is blank / notes missing | Open via `preview.bat`, not by double-clicking the HTML — `fetch()` needs `http://`. |
