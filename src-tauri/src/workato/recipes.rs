use serde::{Deserialize, Deserializer, Serialize};
use tauri::AppHandle;

use crate::config::load_config_internal;
use super::client::WorkatoClient;

// code が二重シリアライズされた文字列で返ってくることがあるので、
// 文字列なら再パースしてオブジェクトに戻す
fn deserialize_code<'de, D>(deserializer: D) -> Result<Option<serde_json::Value>, D::Error>
where
    D: Deserializer<'de>,
{
    let value: Option<serde_json::Value> = Option::deserialize(deserializer)?;
    Ok(value.map(|v| match &v {
        serde_json::Value::String(s) => {
            serde_json::from_str(s).unwrap_or(v)
        }
        _ => v,
    }))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RecipeConfigEntry {
    pub keyword: Option<String>,
    pub name: Option<String>,
    pub provider: Option<String>,
    pub account_id: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Recipe {
    pub id: i64,
    pub name: String,
    pub running: Option<bool>,
    pub description: Option<String>,
    pub last_run_at: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub stopped_at: Option<String>,
    pub job_succeeded_count: Option<i64>,
    pub job_failed_count: Option<i64>,
    #[serde(default)]
    pub folder_id: Option<i64>,
    #[serde(default)]
    pub project_id: Option<i64>,
    #[serde(default)]
    pub config: Vec<RecipeConfigEntry>,
    #[serde(default, deserialize_with = "deserialize_code")]
    pub code: Option<serde_json::Value>,
}

#[derive(Deserialize)]
pub struct RecipeListResponse {
    pub items: Vec<Recipe>,
}

fn make_client(app: &AppHandle) -> Result<WorkatoClient, String> {
    let config = load_config_internal(app)?;
    if config.api_token.is_empty() {
        return Err("API トークンが設定されていません。設定ページで入力してください。".to_string());
    }
    Ok(WorkatoClient::new(config.api_token, config.base_url, config.proxy_url, app.clone()))
}

/// 個別レシピ取得（description 等リスト API で省略されるフィールドを補完するため）
pub(crate) async fn fetch_recipe_detail(client: &WorkatoClient, id: i64) -> Result<Recipe, String> {
    let response = client
        .get(&format!("/api/recipes/{}", id))
        .await?;

    if !response.is_success() {
        return Err(format!("API エラー {}: {}", response.status, response.body));
    }

    response.json()
}

#[tauri::command]
pub async fn get_recipes(app: AppHandle) -> Result<Vec<Recipe>, String> {
    let client = make_client(&app)?;
    let mut all = Vec::new();
    let per_page: usize = 100;
    let mut page = 1usize;

    loop {
        let response = client
            .get(&format!("/api/recipes?page={}&per_page={}", page, per_page))
            .await?;

        if !response.is_success() {
            return Err(format!("API エラー {}: {}", response.status, response.body));
        }

        let data: RecipeListResponse = response.json()?;
        let fetched = data.items.len();
        all.extend(data.items);

        if fetched < per_page {
            break;
        }
        page += 1;
    }

    Ok(all)
}

#[tauri::command]
pub async fn get_recipes_by_ids(app: AppHandle, ids: Vec<i64>) -> Result<Vec<Recipe>, String> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let client = make_client(&app)?;

    use futures::stream::{self, StreamExt};

    let results: Vec<_> = stream::iter(ids)
        .map(|id| fetch_recipe_detail(&client, id))
        .buffer_unordered(5)
        .collect()
        .await;

    // 部分失敗を許容し、取得できたレシピだけ返す
    Ok(results.into_iter().filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub async fn start_recipe(app: AppHandle, id: i64) -> Result<(), String> {
    let client = make_client(&app)?;
    let response = client.put(&format!("/api/recipes/{}/start", id)).await?;

    if !response.is_success() {
        return Err(format!("API エラー {}: {}", response.status, response.body));
    }
    Ok(())
}

#[tauri::command]
pub async fn stop_recipe(app: AppHandle, id: i64) -> Result<(), String> {
    let client = make_client(&app)?;
    let response = client.put(&format!("/api/recipes/{}/stop", id)).await?;

    if !response.is_success() {
        return Err(format!("API エラー {}: {}", response.status, response.body));
    }
    Ok(())
}
