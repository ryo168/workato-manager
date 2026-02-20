use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::config::load_config_internal;
use super::client::WorkatoClient;

#[derive(Serialize, Deserialize, Clone)]
pub struct Job {
    pub id: String,
    pub title: Option<String>,
    pub is_error: Option<bool>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error: Option<String>,
}

#[derive(Deserialize)]
struct JobListResponse {
    items: Vec<Job>,
}

fn make_client(app: &AppHandle) -> Result<WorkatoClient, String> {
    let config = load_config_internal(app)?;
    if config.api_token.is_empty() {
        return Err("API トークンが設定されていません。設定ページで入力してください。".to_string());
    }
    Ok(WorkatoClient::new(config.api_token, config.base_url, app.clone()))
}

#[tauri::command]
pub async fn get_jobs(app: AppHandle, recipe_id: i64) -> Result<Vec<Job>, String> {
    let client = make_client(&app)?;
    let response = client.get(&format!("/api/recipes/{}/jobs", recipe_id)).await?;

    if !response.is_success() {
        return Err(format!("API エラー {}: {}", response.status, response.body));
    }

    let data: JobListResponse = response.json()?;
    Ok(data.items)
}
