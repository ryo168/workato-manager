//! レシピの一覧取得・個別取得・起動・停止。
//!
//! Workato の「レシピ」は自動化ワークフローの単位。
//! このモジュールでは以下の Tauri コマンドを提供する:
//!
//! - [`get_recipes`] — 全レシピをページング取得
//! - [`get_recipes_by_ids`] — 指定 ID のレシピを並列取得
//! - [`start_recipe`] — レシピを起動
//! - [`stop_recipe`] — レシピを停止

use serde::{Deserialize, Deserializer, Serialize};
use tauri::AppHandle;

use super::client::{self, WorkatoClient};

/// レシピの `code` フィールドをデシリアライズする。
///
/// Workato API はレシピの `code` を JSON オブジェクトで返す場合と、
/// 二重シリアライズされた JSON 文字列で返す場合がある。
/// 文字列の場合は再パースしてオブジェクトに変換する。
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

/// レシピ内で使用されるコネクション設定の 1 エントリ。
///
/// レシピの `config` 配列の各要素に対応し、
/// どのコネクション（`account_id`）をどのキーワードで参照しているかを保持する。
#[derive(Serialize, Deserialize, Clone)]
pub struct RecipeConfigEntry {
    /// コネクションのキーワード識別子。
    pub keyword: Option<String>,
    /// コネクションの表示名。
    pub name: Option<String>,
    /// コネクションのプロバイダ名（例: `"salesforce"`, `"slack"`）。
    pub provider: Option<String>,
    /// 紐づくコネクション ID。文字列・数値の両方で返される可能性がある。
    pub account_id: Option<serde_json::Value>,
}

/// Workato レシピ。
///
/// リスト API（`/api/recipes`）と個別 API（`/api/recipes/{id}`）の両方の
/// レスポンスに対応する。リスト API では `description` や `code` が省略される場合がある。
#[derive(Serialize, Deserialize, Clone)]
pub struct Recipe {
    /// レシピ ID。
    pub id: i64,
    /// レシピ名。
    pub name: String,
    /// 実行状態。`true` = 稼働中、`false` = 停止中、`None` = 状態不明。
    pub running: Option<bool>,
    /// レシピの説明文。リスト API では省略されることがある。
    pub description: Option<String>,
    /// 最後に実行された日時（ISO 8601）。
    pub last_run_at: Option<String>,
    /// 作成日時。
    pub created_at: Option<String>,
    /// 更新日時。
    pub updated_at: Option<String>,
    /// 停止日時。
    pub stopped_at: Option<String>,
    /// 成功ジョブの累計数。
    pub job_succeeded_count: Option<i64>,
    /// 失敗ジョブの累計数。
    pub job_failed_count: Option<i64>,
    /// 所属フォルダの ID。
    #[serde(default)]
    pub folder_id: Option<i64>,
    /// 所属プロジェクトの ID。
    #[serde(default)]
    pub project_id: Option<i64>,
    /// トリガーに使用されるアプリケーション名（例: `"salesforce"`, `"scheduler"`）。
    #[serde(default)]
    pub trigger_application: Option<String>,
    /// レシピが使用するコネクション設定の一覧。
    #[serde(default)]
    pub config: Vec<RecipeConfigEntry>,
    /// レシピのワークフロー定義（JSON ツリー）。二重シリアライズに対応。
    #[serde(default, deserialize_with = "deserialize_code")]
    pub code: Option<serde_json::Value>,
}

/// レシピ一覧 API のレスポンス。
///
/// `/api/recipes` は `{ "items": [...] }` 形式で返す。
#[derive(Deserialize)]
pub struct RecipeListResponse {
    pub items: Vec<Recipe>,
}

/// 個別レシピを取得する。
///
/// リスト API では省略される `description` や `code` を含む完全なレシピ情報を返す。
/// [`get_recipes_by_ids`] や [`get_project_recipes`](super::folders::get_project_recipes) から
/// 内部的に呼び出される。
///
/// # エラー
///
/// API リクエストが失敗した場合、またはレスポンスのパースに失敗した場合。
pub(crate) async fn fetch_recipe_detail(client: &WorkatoClient, id: i64) -> Result<Recipe, String> {
    let response = client
        .get(&format!("/api/recipes/{}", id))
        .await?;

    if !response.is_success() {
        return Err(format!("API エラー {}: {}", response.status, response.body));
    }

    response.json()
}

/// 全レシピをページングで取得する Tauri コマンド。
///
/// `invoke("get_recipes")` で呼び出される。
/// `/api/recipes` を 100 件ずつページングして全レシピを取得する。
///
/// # エラー
///
/// API トークン未設定、ネットワークエラー、またはレスポンスのパース失敗。
#[tauri::command]
pub async fn get_recipes(app: AppHandle) -> Result<Vec<Recipe>, String> {
    let client = client::make_client(&app)?;
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

/// 指定した ID のレシピを並列で個別取得する Tauri コマンド。
///
/// `invoke("get_recipes_by_ids", { ids })` で呼び出される。
/// 最大 5 並列で [`fetch_recipe_detail`] を呼び出し、API 負荷を抑制する。
/// 部分的に取得に失敗したレシピは結果から除外される（エラーにはならない）。
///
/// # エラー
///
/// API トークン未設定の場合のみ。個別レシピの取得失敗は黙殺される。
#[tauri::command]
pub async fn get_recipes_by_ids(app: AppHandle, ids: Vec<i64>) -> Result<Vec<Recipe>, String> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let client = client::make_client(&app)?;

    use futures::stream::{self, StreamExt};

    let results: Vec<_> = stream::iter(ids)
        .map(|id| fetch_recipe_detail(&client, id))
        .buffer_unordered(10)
        .collect()
        .await;

    Ok(results.into_iter().filter_map(|r| r.ok()).collect())
}

/// レシピを起動する Tauri コマンド。
///
/// `invoke("start_recipe", { id })` で呼び出される。
/// `PUT /api/recipes/{id}/start` を実行する。
///
/// # エラー
///
/// API トークン未設定、ネットワークエラー、または API がエラーを返した場合。
#[tauri::command]
pub async fn start_recipe(app: AppHandle, id: i64) -> Result<(), String> {
    let client = client::make_client(&app)?;
    let response = client.put(&format!("/api/recipes/{}/start", id)).await?;

    if !response.is_success() {
        return Err(format!("API エラー {}: {}", response.status, response.body));
    }
    Ok(())
}

/// レシピを停止する Tauri コマンド。
///
/// `invoke("stop_recipe", { id })` で呼び出される。
/// `PUT /api/recipes/{id}/stop` を実行する。
///
/// # エラー
///
/// API トークン未設定、ネットワークエラー、または API がエラーを返した場合。
#[tauri::command]
pub async fn stop_recipe(app: AppHandle, id: i64) -> Result<(), String> {
    let client = client::make_client(&app)?;
    let response = client.put(&format!("/api/recipes/{}/stop", id)).await?;

    if !response.is_success() {
        return Err(format!("API エラー {}: {}", response.status, response.body));
    }
    Ok(())
}
