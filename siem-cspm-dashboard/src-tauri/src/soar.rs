use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::Client;
use aws_sdk_s3::types::{PublicAccessBlockConfiguration};
use keyring::Entry;
use aws_credential_types::Credentials;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct RemediationResult {
    success: bool,
    message: String,
}

#[tauri::command]
pub async fn remediate_s3_public_access(bucket_name: String) -> Result<String, String> {
    let access_entry = Entry::new("siem_cspm_dashboard", "aws_access_key").map_err(|e| e.to_string())?;
    let secret_entry = Entry::new("siem_cspm_dashboard", "aws_secret_key").map_err(|e| e.to_string())?;

    let access_key = access_entry.get_password().map_err(|e| e.to_string())?;
    let secret_key = secret_entry.get_password().map_err(|e| e.to_string())?;

    let credentials = Credentials::new(
        access_key,
        secret_key,
        None,
        None,
        "siem_provider",
    );

    let region_provider = RegionProviderChain::default_provider().or_else("us-east-1");
    
    #[allow(deprecated)]
    let config = aws_config::from_env()
        .credentials_provider(credentials)
        .region(region_provider)
        .load()
        .await;

    let client = Client::new(&config);

    // Enforce Block Public Access
    let public_access_config = PublicAccessBlockConfiguration::builder()
        .block_public_acls(true)
        .ignore_public_acls(true)
        .block_public_policy(true)
        .restrict_public_buckets(true)
        .build();

    let result = client.put_public_access_block()
        .bucket(&bucket_name)
        .public_access_block_configuration(public_access_config)
        .send()
        .await;

    match result {
        Ok(_) => {
            let res = RemediationResult {
                success: true,
                message: format!("Successfully blocked all public access for bucket '{}'", bucket_name),
            };
            serde_json::to_string(&res).map_err(|e| e.to_string())
        }
        Err(e) => {
            let res = RemediationResult {
                success: false,
                message: format!("Failed to remediate bucket '{}': {}", bucket_name, e),
            };
            serde_json::to_string(&res).map_err(|e| e.to_string())
        }
    }
}
