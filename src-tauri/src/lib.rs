use argon2::{Algorithm, Argon2, Params, Version};

mod core_bootstrap;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // K1 consolidation (prompts/10 decision 1/4): the per-app `myhealth.db` and its
    // Tauri-plugin migration array (0001–0009) are RETIRED. All myHealth data now lives in
    // the ONE shared suite DB as app-owned `myhealth_*` tables, created from semantic
    // SchemaDescriptors + aux-SQL on the JS side (src/db/appTables.ts, auxMigrations.ts).
    // The SQL plugin stays registered (below) only so the app can open DBs by path —
    // including the legacy `myhealth.db` during the one-time migration (src/db/consolidate.ts),
    // which copies it into suite.db and then deletes the file.

    // ── PER-APP SECRET — DO NOT CHANGE ────────────────────────────────────────
    // Stronghold's snapshot key is derived from the user's master password with
    // Argon2id using this constant, per-app salt + params. Changing the salt or
    // params makes every existing user's vault snapshot undecryptable (bricked).
    // This salt is distinct from every other suite app's — vaults are never shared.
    const SALT: &[u8] = b"myHealth-stronghold-v1-salt";

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            core_bootstrap::shared_core_masters_dir,
            core_bootstrap::shared_core_db_path,
        ])
        .setup(|app| {
            // L2 shared-core bootstrap: lay down or reuse the per-user suite dir and
            // register this app as an owner (idempotent). Standalone-safe — on any
            // failure it falls back to this app's own data dir.
            let _ = core_bootstrap::ensure_shared_core(app.handle());
            Ok(())
        })
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_stronghold::Builder::new(|password| {
                let params = Params::new(15_000, 2, 1, Some(32)).expect("argon2 params");
                let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
                let mut key = [0u8; 32];
                argon
                    .hash_password_into(password.as_bytes(), SALT, &mut key)
                    .expect("argon2 hash");
                key.to_vec()
            })
            .build(),
        )
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
