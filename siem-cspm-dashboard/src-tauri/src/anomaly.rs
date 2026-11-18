use duckdb::{Connection, Result};
use tauri::State;
use crate::db::DbState;
use serde_json::{json, Value};

#[tauri::command]
pub async fn detect_anomalies(db: State<'_, DbState>) -> Result<String, String> {
    let guard = db.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;

    // We'll execute a DuckDB query that finds IPs with > 5 events as a simple anomaly test
    // A real algorithm would compute z-scores over a tumbling window.
    let query = "
        SELECT source_ip, COUNT(*) as event_count 
        FROM api_activity 
        GROUP BY source_ip 
        HAVING event_count > 10
        ORDER BY event_count DESC
    ";

    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    let mut results = Vec::new();

    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let source_ip: String = row.get(0).unwrap_or_default();
        let count: i64 = row.get(1).unwrap_or(0);

        results.push(json!({
            "source_ip": source_ip,
            "event_count": count,
            "anomaly_type": "Volumetric Spike",
            "description": format!("IP {} exceeded normal threshold with {} events.", source_ip, count)
        }));
    }

    serde_json::to_string(&results).map_err(|e| e.to_string())
}
