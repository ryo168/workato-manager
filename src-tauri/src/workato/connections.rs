use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::config::load_config_internal;
use super::client::WorkatoClient;

#[derive(Serialize, Deserialize, Clone)]
pub struct Connection {
    pub id: i64,
    pub name: String,
    pub application: Option<String>,
    pub authorization_status: Option<String>,
    pub authorized_at: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub folder_id: Option<i64>,
    pub project_id: Option<i64>,
}

fn make_client(app: &AppHandle) -> Result<WorkatoClient, String> {
    let config = load_config_internal(app)?;
    if config.api_token.is_empty() {
        return Err("API トークンが設定されていません。設定ページで入力してください。".to_string());
    }
    Ok(WorkatoClient::new(config.api_token, config.base_url, config.proxy_url, app.clone()))
}

#[tauri::command]
pub async fn get_connections(app: AppHandle) -> Result<Vec<Connection>, String> {
    let client = make_client(&app)?;
    let response = client.get("/api/connections").await?;

    if !response.is_success() {
        return Err(format!("API エラー {}: {}", response.status, response.body));
    }

    let data: Vec<Connection> = response.json()?;
    Ok(data)
}
