//! L2 shared-core bootstrap — the "first app installs the core, the second reuses
//! it" mechanism from sharedCoreLib/CONTRACT.md §5, implemented app-side (the Rust
//! transport/bootstrap is intentionally NOT in the shared npm package). Portable
//! across all installers because it runs in `lib.rs` setup.
//!
//! Two layers of "core":
//!   * L1 — the build-time TS/React library (`sharedcorelib`) — is bundled into
//!     this app's webview bundle; it is never runtime-shared.
//!   * L2 — heavy, downloaded runtime assets (the OTA masters cache, and any
//!     native sidecars/models) — IS shared, once, in a per-user suite dir.
//!
//! This module manages L2: a per-user (no-admin) shared dir with a refcounted
//! `manifest.json { core_version, owners[] }`. Lay-down-or-reuse on startup,
//! standalone fallback if the shared dir is unusable, and a deregister hook for
//! uninstall. NEVER touches user data (vault/DB/settings stay strictly per-app).

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

/// L2 layout version this app bundles. Bump for backward-compatible layout changes
/// (a newer app upgrades it in place). A breaking change moves to `core/v2`.
pub const CORE_VERSION: u32 = 1;

/// This app's stable id in the shared `owners[]` refcount. Must be unique per app.
pub const APP_ID: &str = "myHealth";

/// Suite root folder name under the per-user local-data dir, shared across the suite.
const SUITE_DIR: &str = "SharedCoreLib";

#[derive(Serialize, Deserialize, Default)]
struct CoreManifest {
    #[serde(default)]
    core_version: u32,
    #[serde(default)]
    owners: Vec<String>,
}

/// The shared suite core dir: `<local_data_dir>/SharedCoreLib/core`.
fn shared_core_dir<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .local_data_dir()
        .ok()
        .map(|d| d.join(SUITE_DIR).join("core"))
}

fn read_manifest(dir: &Path) -> CoreManifest {
    fs::read_to_string(dir.join("manifest.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_manifest(dir: &Path, m: &CoreManifest) -> std::io::Result<()> {
    fs::create_dir_all(dir)?;
    let json = serde_json::to_string_pretty(m).unwrap_or_default();
    fs::write(dir.join("manifest.json"), json)
}

/// Lay down or reuse L2, register this app as an owner, and return the **masters
/// OTA cache dir** to inject into the JS updater. Standalone-safe: on any failure
/// it falls back to this app's own data dir, so an app installed alone always works.
pub fn ensure_shared_core<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    if let Some(dir) = shared_core_dir(app) {
        if try_ensure(&dir).is_ok() {
            return dir.join("masters");
        }
    }
    let fallback = app
        .path()
        .app_data_dir()
        .map(|d| d.join("masters"))
        .unwrap_or_else(|_| PathBuf::from("masters"));
    let _ = fs::create_dir_all(&fallback);
    fallback
}

fn try_ensure(dir: &Path) -> std::io::Result<()> {
    let mut m = read_manifest(dir);

    // Lay-down-or-reuse + in-place upgrade within the same major.
    if m.core_version < CORE_VERSION {
        m.core_version = CORE_VERSION;
    }

    fs::create_dir_all(dir.join("masters"))?; // OTA reference-data cache
    fs::create_dir_all(dir.join("db"))?; // shared suite database (per-app + common tables)
    fs::create_dir_all(dir.join("bin"))?; // shared native sidecars (if any)
    fs::create_dir_all(dir.join("models"))?; // shared ML models (if any)

    // Refcount: register this app (idempotent).
    if !m.owners.iter().any(|o| o == APP_ID) {
        m.owners.push(APP_ID.to_string());
    }

    write_manifest(dir, &m)
}

/// Uninstall hook: drop this app from `owners[]`; delete the shared dir ONLY when
/// the last owner leaves. Wire into the installer's uninstall step. Best-effort.
#[allow(dead_code)]
pub fn deregister_shared_core<R: Runtime>(app: &AppHandle<R>) {
    if let Some(dir) = shared_core_dir(app) {
        let mut m = read_manifest(&dir);
        m.owners.retain(|o| o != APP_ID);
        if m.owners.is_empty() {
            let _ = fs::remove_dir_all(&dir);
        } else {
            let _ = write_manifest(&dir, &m);
        }
    }
}

/// Expose the (ensured) shared masters cache dir to the webview so the JS OTA
/// updater can inject it as its `cacheDir`. Idempotent.
#[tauri::command]
pub fn shared_core_masters_dir(app: AppHandle) -> String {
    ensure_shared_core(&app).to_string_lossy().to_string()
}

/// The shared suite DATABASE file: `<shared core>/db/suite.db` — the ONE SQLite the
/// suite shares (per-app + common tables, governed by the schema registry; see
/// sharedcorelib/db). Standalone-safe: falls back to this app's own data dir if the
/// shared dir is unusable, so an app installed alone still works. Idempotent.
pub fn shared_core_db_file<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    if let Some(dir) = shared_core_dir(app) {
        if try_ensure(&dir).is_ok() {
            return dir.join("db").join("suite.db");
        }
    }
    app.path()
        .app_data_dir()
        .map(|d| d.join("suite.db"))
        .unwrap_or_else(|_| PathBuf::from("suite.db"))
}

/// Webview-facing path to the shared suite DB, loaded via the SQL plugin as
/// `Database.load("sqlite:" + path)`. Idempotent (ensures the shared dir first).
#[tauri::command]
pub fn shared_core_db_path(app: AppHandle) -> String {
    shared_core_db_file(&app).to_string_lossy().to_string()
}
