use siem_cspm_dashboard_lib::db::{init_db, insert_cloudtrail_event};
use siem_cspm_dashboard_lib::query_parser::parse_dsl_to_sql;
use serde_json::json;

#[test]
fn test_database_and_ingestion() {
    // 1. Init DB
    let conn = init_db().expect("Failed to init DB");

    // 2. Insert mock AWS log
    let mock_aws_log = json!({
        "eventVersion": "1.08",
        "userIdentity": { "type": "IAMUser", "userName": "test_user" },
        "eventTime": "2023-10-10T12:00:00Z",
        "eventSource": "s3.amazonaws.com",
        "eventName": "GetObject",
        "awsRegion": "us-east-1",
        "sourceIPAddress": "1.2.3.4"
    });
    insert_cloudtrail_event(&conn, &mock_aws_log.to_string(), Some("AWS")).expect("Failed to insert AWS log");

    // 3. Insert mock Azure log
    let mock_azure_log = json!({
        "eventTime": "2023-10-10T12:05:00Z",
        "eventName": "Sign-in activity",
        "eventSource": "Azure Active Directory",
        "userIdentity": { "userName": "test_user@azure.com" },
        "sourceIPAddress": "5.6.7.8"
    });
    insert_cloudtrail_event(&conn, &mock_azure_log.to_string(), Some("Azure")).expect("Failed to insert Azure log");

    // 4. Test DSL to SQL
    let dsl = "cloud_provider:\"Azure\"";
    let sql = parse_dsl_to_sql(dsl);
    
    // 5. Query Logs
    let mut stmt = conn.prepare(&sql).expect("Failed to prepare statement");
    let mut rows = stmt.query([]).expect("Failed to execute query");
    
    let mut count = 0;
    while let Some(row) = rows.next().expect("Failed to fetch row") {
        let provider: String = row.get(6).unwrap_or_default(); // column 6 is cloud_provider
        assert_eq!(provider, "Azure");
        count += 1;
    }
    assert_eq!(count, 1, "Should find exactly 1 Azure log");

    // 6. Test Anomalies Query
    let anomaly_query = "
        SELECT source_ip, COUNT(*) as event_count 
        FROM api_activity 
        GROUP BY source_ip 
        HAVING event_count > 0
    ";
    let mut stmt2 = conn.prepare(anomaly_query).expect("Failed to prepare anomaly query");
    let mut rows2 = stmt2.query([]).expect("Failed to execute anomaly query");
    let mut anomaly_count = 0;
    while let Some(_) = rows2.next().unwrap() {
        anomaly_count += 1;
    }
    assert_eq!(anomaly_count, 2, "Should find 2 unique IPs");
}
