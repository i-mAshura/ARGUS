use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Alert {
    pub id: String,
    pub severity: String,
    pub rule_name: String,
    pub source_ip: String,
    pub mitre_tactic: String,
    pub mitre_technique: String,
    pub time: String,
    pub description: String,
}

#[tauri::command]
pub async fn fetch_alerts() -> Result<String, String> {
    // In a fully integrated system, this would correlate DuckDB logs continuously.
    // For MVP/Demo, we present synthetic alerts showcasing MITRE ATT&CK mappings.
    let alerts = vec![
        Alert {
            id: "ALT-1001".into(),
            severity: "HIGH".into(),
            rule_name: "Multiple Failed Logins (Console)".into(),
            source_ip: "192.168.1.45".into(),
            mitre_tactic: "Credential Access".into(),
            mitre_technique: "T1110 (Brute Force)".into(),
            time: "2 mins ago".into(),
            description: "User attempted to login 15 times within 1 minute from the same IP.".into(),
        },
        Alert {
            id: "ALT-1002".into(),
            severity: "CRITICAL".into(),
            rule_name: "S3 Bucket ACL Made Public".into(),
            source_ip: "10.0.0.5".into(),
            mitre_tactic: "Defense Evasion".into(),
            mitre_technique: "T1222 (File and Directory Permissions Modification)".into(),
            time: "15 mins ago".into(),
            description: "IAM User 'alice_admin' modified bucket ACL to allow public Read access.".into(),
        },
        Alert {
            id: "ALT-1003".into(),
            severity: "MEDIUM".into(),
            rule_name: "EC2 Security Group Opened to 0.0.0.0/0".into(),
            source_ip: "203.0.113.50".into(),
            mitre_tactic: "Initial Access".into(),
            mitre_technique: "T1190 (Exploit Public-Facing Application)".into(),
            time: "1 hour ago".into(),
            description: "Port 22 SSH access was opened to the public internet.".into(),
        },
        Alert {
            id: "ALT-1004".into(),
            severity: "CRITICAL".into(),
            rule_name: "Cross-Cloud Lateral Movement".into(),
            source_ip: "192.168.1.45".into(),
            mitre_tactic: "Lateral Movement".into(),
            mitre_technique: "T1078 (Valid Accounts)".into(),
            time: "1 min ago".into(),
            description: "IP address authenticated to AWS, then immediately pivoted to Azure AD and GCP IAM.".into(),
        },
    ];

    serde_json::to_string(&alerts).map_err(|e| e.to_string())
}
