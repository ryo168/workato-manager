//! ジョブ（レシピの実行履歴）の取得。
//!
//! Workato の「ジョブ」はレシピが 1 回実行された記録。
//! 成功/失敗のステータス、開始・完了日時、エラー内容を保持する。

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use super::client;

/// レシピの実行履歴 1 件。
#[derive(Serialize, Deserialize, Clone)]
pub struct Job {
    /// ジョブ ID（文字列形式）。
    pub id: String,
    /// ジョブのタイトル。
    pub title: Option<String>,
    /// エラーで終了したかどうか。`true` = エラー。
    pub is_error: Option<bool>,
    /// ジョブの開始日時（ISO 8601）。
    pub started_at: Option<String>,
    /// ジョブの完了日時（ISO 8601）。
    pub completed_at: Option<String>,
    /// エラー時のメッセージ。
    pub error: Option<String>,
}

/// ジョブ一覧 API のレスポンス。
///
/// `/api/recipes/{id}/jobs` は `{ "items": [...] }` 形式で返す。
#[derive(Deserialize)]
struct JobListResponse {
    items: Vec<Job>,
}

/// 指定レシピのジョブ一覧を取得する Tauri コマンド。
///
/// `invoke("get_jobs", { recipeId })` で呼び出される。
/// `/api/recipes/{recipe_id}/jobs` の結果を返す。
///
/// # エラー
///
/// API トークン未設定、ネットワークエラー、またはレスポンスのパース失敗。
#[tauri::command]
pub async fn get_jobs(app: AppHandle, recipe_id: i64) -> Result<Vec<Job>, String> {
    let client = client::make_client(&app)?;
    let response = client.get(&format!("/api/recipes/{}/jobs", recipe_id)).await?;

    if !response.is_success() {
        return Err(format!("API エラー {}: {}", response.status, response.body));
    }

    let data: JobListResponse = response.json()?;
    Ok(data.items)
}
