use aws_config::meta::region::RegionProviderChain;
use aws_sdk_cloudtrail::Client;
use keyring::Entry;
use aws_credential_types::Credentials;
use crate::db::{DbState, insert_cloudtrail_event};
use tauri::State;

pub async fn fetch_cloudtrail_logs(db: &State<'_, DbState>) -> Result<String, String> {
    // 1. Retrieve credentials securely from the OS Keyring
    let access_entry = Entry::new("siem_cspm_dashboard", "aws_access_key").map_err(|e| e.to_string())?;
    let secret_entry = Entry::new("siem_cspm_dashboard", "aws_secret_key").map_err(|e| e.to_string())?;

    let access_key = access_entry.get_password().map_err(|e| e.to_string())?;
    let secret_key = secret_entry.get_password().map_err(|e| e.to_string())?;

    // 2. Set up AWS Configuration
    let region_provider = RegionProviderChain::default_provider().or_else("us-east-1");
    let credentials = Credentials::new(
        access_key,
        secret_key,
        None,
        None,
        "keyring",
    );

    #[allow(deprecated)]
    let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(region_provider)
        .credentials_provider(credentials)
        .load()
        .await;

    let client = Client::new(&config);

    // 3. Fetch recent CloudTrail events (example: last 10)
    let resp = client.lookup_events().max_results(10).send().await.map_err(|e| e.to_string())?;
    
    let mut logs = String::new();
    let mut inserted = 0;
    
    let guard = db.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;

    for event in resp.events() {
        if let Some(cloud_trail_event) = event.cloud_trail_event() {
            if insert_cloudtrail_event(conn, cloud_trail_event, Some("AWS")).is_ok() {
                inserted += 1;
            }
            logs.push_str(cloud_trail_event);
            logs.push('\n');
        }
    }

    Ok(format!("Successfully ingested {} events", inserted))
}

#[tauri::command]
pub async fn trigger_ingestion(db: State<'_, DbState>) -> Result<String, String> {
    fetch_cloudtrail_logs(&db).await
}
