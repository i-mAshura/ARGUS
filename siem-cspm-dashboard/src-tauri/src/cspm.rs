use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct CspmFinding {
    pub rule_id: String,
    pub title: String,
    pub severity: String,
    pub resource: String,
    pub status: String,
    pub description: String,
}

#[tauri::command]
pub async fn run_cspm_scan() -> Result<String, String> {
    // In a real environment, this would call aws-sdk-s3, aws-sdk-iam, etc.
    // We mock the findings for the dashboard demo as specified in the Capstone proposal.
    let findings = vec![
        CspmFinding {
            rule_id: "S3.1".into(),
            title: "S3 Block Public Access is disabled".into(),
            severity: "HIGH".into(),
            resource: "arn:aws:s3:::company-confidential-data".into(),
            status: "FAIL".into(),
            description: "The S3 bucket does not have Block Public Access enabled at the bucket level.".into(),
        },
        CspmFinding {
            rule_id: "IAM.1".into(),
            title: "IAM Root user does not have MFA enabled".into(),
            severity: "CRITICAL".into(),
            resource: "AWS Account Root".into(),
            status: "FAIL".into(),
            description: "Multi-factor authentication (MFA) is not enabled for the root account.".into(),
        },
        CspmFinding {
            rule_id: "EC2.1".into(),
            title: "Security Group allows unrestricted SSH access".into(),
            severity: "HIGH".into(),
            resource: "sg-0123456789abcdef0".into(),
            status: "FAIL".into(),
            description: "Port 22 is open to 0.0.0.0/0, allowing potential brute-force attacks.".into(),
        },
        CspmFinding {
            rule_id: "RDS.1".into(),
            title: "RDS database is not encrypted at rest".into(),
            severity: "MEDIUM".into(),
            resource: "arn:aws:rds:us-east-1:123456789012:db:production-db".into(),
            status: "FAIL".into(),
            description: "The database instance is not using KMS encryption at rest.".into(),
        },
        CspmFinding {
            rule_id: "KMS.1".into(),
            title: "KMS keys do not have rotation enabled".into(),
            severity: "LOW".into(),
            resource: "arn:aws:kms:us-east-1:123456789012:key/1234-5678".into(),
            status: "FAIL".into(),
            description: "Customer managed keys should have automatic rotation enabled.".into(),
        },
        CspmFinding {
            rule_id: "AZURE.1".into(),
            title: "Azure Blob Storage allows public access".into(),
            severity: "HIGH".into(),
            resource: "azure/storage/blob/public-data".into(),
            status: "FAIL".into(),
            description: "The Azure Storage container is configured to allow public read access.".into(),
        },
        CspmFinding {
            rule_id: "GCP.1".into(),
            title: "GCP Service Account has over-permissive IAM roles".into(),
            severity: "CRITICAL".into(),
            resource: "gcp/iam/service-account/default-compute".into(),
            status: "FAIL".into(),
            description: "The service account has Editor privileges across the entire GCP project.".into(),
        },
    ];

    serde_json::to_string(&findings).map_err(|e| e.to_string())
}
