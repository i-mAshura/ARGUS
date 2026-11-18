use duckdb::{Connection, Result};
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::State;
use crate::query_parser::parse_dsl_to_sql;

pub struct DbState(pub Mutex<Option<Connection>>);

pub fn init_db() -> Result<Connection> {
    // For embedded use case, we create a file-based duckdb database in the app directory,
    // but for simplicity in development, we can use an in-memory database.
    // This also prevents tauri hot-reload loops when database files change.
    let conn = Connection::open_in_memory()?;

    // Drop existing table to apply new schema for multi-cloud (demo purpose)
    conn.execute("DROP TABLE IF EXISTS api_activity", [])?;

    // Create OCSF API Activity Table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS api_activity (
            event_time TIMESTAMP,
            activity_name VARCHAR,
            api_operation VARCHAR,
            api_service_name VARCHAR,
            user_identity VARCHAR,
            source_ip VARCHAR,
            cloud_provider VARCHAR,
            raw_data VARCHAR
        )",
        [],
    )?;

    Ok(conn)
}

pub fn insert_cloudtrail_event(conn: &Connection, raw_json: &str, provider: Option<&str>) -> Result<()> {
    if let Ok(v) = serde_json::from_str::<Value>(raw_json) {
        let event_time = v["eventTime"].as_str().unwrap_or("");
        let activity_name = v["eventName"].as_str().unwrap_or("");
        let api_operation = v["eventName"].as_str().unwrap_or("");
        let api_service_name = v["eventSource"].as_str().unwrap_or("");
        let user_identity = v["userIdentity"]["arn"].as_str().or_else(|| v["userIdentity"]["userName"].as_str()).unwrap_or("unknown");
        let source_ip = v["sourceIPAddress"].as_str().unwrap_or("");
        let cloud_provider = provider.unwrap_or("AWS");

        conn.execute(
            "INSERT INTO api_activity (event_time, activity_name, api_operation, api_service_name, user_identity, source_ip, cloud_provider, raw_data) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            [event_time, activity_name, api_operation, api_service_name, user_identity, source_ip, cloud_provider, raw_json],
        )?;
    }
    Ok(())
}

#[tauri::command]
pub fn query_logs(db: State<'_, DbState>, query: String) -> Result<String, String> {
    let guard = db.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;

    let sql = parse_dsl_to_sql(&query);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    let column_names = vec![
        "event_time".to_string(),
        "activity_name".to_string(),
        "api_operation".to_string(),
        "api_service_name".to_string(),
        "user_identity".to_string(),
        "source_ip".to_string(),
        "cloud_provider".to_string(),
        "raw_data".to_string(),
    ];
    let mut results = Vec::new();

    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut row_map = serde_json::Map::new();
        for (i, name) in column_names.iter().enumerate() {
            // Treating everything as string for MVP
            let val: Result<String, _> = row.get(i);
            row_map.insert(name.clone(), json!(val.unwrap_or_default()));
        }
        results.push(Value::Object(row_map));
    }

    serde_json::to_string(&results).map_err(|e| e.to_string())
}
