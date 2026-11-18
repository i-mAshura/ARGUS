use duckdb::Connection;
use tauri::State;
use crate::db::{DbState, insert_cloudtrail_event};
use serde_json::json;
use chrono::{Utc, Duration};

#[tauri::command]
pub async fn run_stratus_simulation(db: State<'_, DbState>) -> Result<String, String> {
    let guard = db.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("Database not initialized")?;

    let mut inserted = 0;
    let now = Utc::now();

    // Simulate Brute Force (T1110)
    for i in 0..15 {
        let event_time = (now - Duration::seconds(120 - i * 2)).to_rfc3339();
        let brute_force_event = json!({
            "eventVersion": "1.08",
            "userIdentity": {
                "type": "IAMUser",
                "userName": "admin"
            },
            "eventTime": event_time,
            "eventSource": "signin.amazonaws.com",
            "eventName": "ConsoleLogin",
            "awsRegion": "us-east-1",
            "sourceIPAddress": "192.168.1.45",
            "responseElements": { "ConsoleLogin": "Failure" },
            "errorMessage": "Failed authentication"
        });
        if insert_cloudtrail_event(conn, &brute_force_event.to_string(), Some("AWS")).is_ok() {
            inserted += 1;
        }
    }

    // Simulate S3 Bucket ACL Modification (T1222)
    let s3_event_time = (now - Duration::seconds(60)).to_rfc3339();
    let s3_event = json!({
        "eventVersion": "1.08",
        "userIdentity": {
            "type": "IAMUser",
            "userName": "alice_admin",
            "arn": "arn:aws:iam::123456789012:user/alice_admin"
        },
        "eventTime": s3_event_time,
        "eventSource": "s3.amazonaws.com",
        "eventName": "PutBucketAcl",
        "awsRegion": "us-east-1",
        "sourceIPAddress": "10.0.0.5",
        "requestParameters": {
            "bucketName": "company-confidential-data",
            "AccessControlPolicy": {
                "Grant": [
                    { "Grantee": { "URI": "http://acs.amazonaws.com/groups/global/AllUsers" }, "Permission": "READ" }
                ]
            }
        }
    });
    if insert_cloudtrail_event(conn, &s3_event.to_string(), Some("AWS")).is_ok() {
        inserted += 1;
    }

    // Simulate Azure AD Lateral Movement (T1078)
    let azure_event_time = (now - Duration::seconds(45)).to_rfc3339();
    let azure_event = json!({
        "eventTime": azure_event_time,
        "eventName": "Sign-in activity",
        "eventSource": "Azure Active Directory",
        "userIdentity": { "userName": "alice_admin@company.com" },
        "sourceIPAddress": "192.168.1.45"
    });
    if insert_cloudtrail_event(conn, &azure_event.to_string(), Some("Azure")).is_ok() {
        inserted += 1;
    }

    // Simulate GCP IAM Tampering (T1098)
    let gcp_event_time = (now - Duration::seconds(30)).to_rfc3339();
    let gcp_event = json!({
        "eventTime": gcp_event_time,
        "eventName": "SetIamPolicy",
        "eventSource": "cloudresourcemanager.googleapis.com",
        "userIdentity": { "userName": "alice_admin@company.com" },
        "sourceIPAddress": "192.168.1.45"
    });
    if insert_cloudtrail_event(conn, &gcp_event.to_string(), Some("GCP")).is_ok() {
        inserted += 1;
    }

    Ok(format!("Successfully simulated {} multi-cloud red team events.", inserted))
}
