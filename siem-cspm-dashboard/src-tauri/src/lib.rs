pub mod aws_ingestion;
pub mod db;
pub mod query_parser;
pub mod cspm;
pub mod alerts;
pub mod soar;
pub mod simulator;
pub mod anomaly;

use keyring::Entry;
use tauri::Manager;
use std::sync::Mutex;

#[tauri::command]
fn save_aws_credentials(access_key: &str, secret_key: &str) -> Result<(), String> {
    let access_entry = Entry::new("siem_cspm_dashboard", "aws_access_key").map_err(|e| e.to_string())?;
    let secret_entry = Entry::new("siem_cspm_dashboard", "aws_secret_key").map_err(|e| e.to_string())?;

    access_entry.set_password(access_key).map_err(|e| e.to_string())?;
    secret_entry.set_password(secret_key).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn check_aws_credentials() -> bool {
    let access_entry = Entry::new("siem_cspm_dashboard", "aws_access_key");
    let secret_entry = Entry::new("siem_cspm_dashboard", "aws_secret_key");

    if let (Ok(a), Ok(s)) = (access_entry, secret_entry) {
        return a.get_password().is_ok() && s.get_password().is_ok();
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let conn = db::init_db().expect("Failed to initialize DuckDB");
            app.manage(db::DbState(Mutex::new(Some(conn))));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_aws_credentials,
            check_aws_credentials,
            aws_ingestion::trigger_ingestion,
            db::query_logs,
            cspm::run_cspm_scan,
            alerts::fetch_alerts,
            soar::remediate_s3_public_access,
            simulator::run_stratus_simulation,
            anomaly::detect_anomalies
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
