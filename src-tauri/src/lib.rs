use tauri_plugin_sql::{Migration, MigrationKind};

/// Durable on-device store: one SQLite row holds the whole Hive snapshot.
/// The frontend (src/lib/repo.ts) also creates this table lazily, so the
/// migration below is belt-and-braces for fresh installs.
fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create kv snapshot table",
        sql: "CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:hive-pm.db", migrations())
        .build(),
    )
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
