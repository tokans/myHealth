use argon2::{Algorithm, Argon2, Params, Version};
use tauri_plugin_sql::{Migration, MigrationKind};

mod core_bootstrap;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "settings + usage telemetry",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "profiles (self + family) + baseline",
            sql: include_str!("../migrations/0002_profiles.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "metrics / vitals time-series",
            sql: include_str!("../migrations/0003_metrics.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "health goals",
            sql: include_str!("../migrations/0004_goals.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "reminders (manual + derived)",
            sql: include_str!("../migrations/0005_reminders.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "daily habits: tasks, water, schedule",
            sql: include_str!("../migrations/0006_daily_habits.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "medications",
            sql: include_str!("../migrations/0007_medications.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "profile emergency / ICE fields",
            sql: include_str!("../migrations/0008_profile_emergency.sql"),
            kind: MigrationKind::Up,
        },
    ];

    // ── PER-APP SECRET — DO NOT CHANGE ────────────────────────────────────────
    // Stronghold's snapshot key is derived from the user's master password with
    // Argon2id using this constant, per-app salt + params. Changing the salt or
    // params makes every existing user's vault snapshot undecryptable (bricked).
    // This salt is distinct from every other suite app's — vaults are never shared.
    const SALT: &[u8] = b"myHealth-stronghold-v1-salt";

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            core_bootstrap::shared_core_masters_dir,
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
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:myhealth.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
