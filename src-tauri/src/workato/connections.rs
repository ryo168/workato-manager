//! コネクション（外部サービス接続）の一覧取得。
//!
//! Workato の「コネクション」は外部サービス（Salesforce、Slack 等）への
//! 認証済み接続を表す。レシピはコネクションを参照してサービスにアクセスする。

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use super::client;

/// Workato コネクション。
///
/// 外部サービスへの認証済み接続情報を保持する。
#[derive(Serialize, Deserialize, Clone)]
pub struct Connection {
    /// コネクション ID。
    pub id: i64,
    /// コネクション名（ユーザーが設定した表示名）。
    pub name: String,
    /// 接続先アプリケーション名（例: `"salesforce"`, `"slack"`）。
    pub application: Option<String>,
    /// 認証ステータス。`"success"` であれば認証済み。
    pub authorization_status: Option<String>,
    /// 認証が成功した日時（ISO 8601）。
    pub authorized_at: Option<String>,
    /// 作成日時。
    pub created_at: Option<String>,
    /// 更新日時。
    pub updated_at: Option<String>,
    /// 所属フォルダの ID。
    pub folder_id: Option<i64>,
    /// 所属プロジェクトの ID。
    pub project_id: Option<i64>,
}

/// 全コネクションを取得する Tauri コマンド。
///
/// `invoke("get_connections")` で呼び出される。
/// `/api/connections` の結果をそのまま返す。
///
/// # エラー
///
/// API トークン未設定、ネットワークエラー、またはレスポンスのパース失敗。
#[tauri::command]
pub async fn get_connections(app: AppHandle) -> Result<Vec<Connection>, String> {
    let client = client::make_client(&app)?;
    let response = client.get("/api/connections").await?;

    if !response.is_success() {
        return Err(format!("API エラー {}: {}", response.status, response.body));
    }

    let data: Vec<Connection> = response.json()?;
    Ok(data)
}
