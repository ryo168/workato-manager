//! Workato REST API 用 HTTP クライアント。
//!
//! Bearer トークン認証、プロキシ対応、リクエスト/レスポンスのログ出力を
//! 一箇所にまとめた共通クライアント。
//! 各リソースモジュール（[`super::recipes`] 等）はこのクライアントを通じて API を呼び出す。

use reqwest::Client;
use tauri::AppHandle;

use crate::config::load_config_internal;
use crate::logger;

/// Workato API からの HTTP レスポンスを保持する。
///
/// ステータスコードとボディ文字列をそのまま保持し、
/// 呼び出し側で成功判定やデシリアライズを行う。
pub struct ApiResponse {
    pub status: reqwest::StatusCode,
    pub body: String,
}

impl ApiResponse {
    /// HTTP ステータスコードが 2xx であれば `true` を返す。
    pub fn is_success(&self) -> bool {
        self.status.is_success()
    }

    /// レスポンスボディを JSON としてデシリアライズする。
    ///
    /// # エラー
    ///
    /// JSON のパースに失敗した場合、エラーメッセージを返す。
    pub fn json<T: serde::de::DeserializeOwned>(&self) -> Result<T, String> {
        serde_json::from_str(&self.body).map_err(|e| format!("JSON parse error: {}", e))
    }
}

/// Workato API 用の認証付き HTTP クライアント。
///
/// リクエストごとに Bearer トークンを付与し、
/// リクエスト/レスポンスの内容をログファイルに記録する。
///
/// # プロキシ対応
///
/// `proxy_url` が指定されている場合、全リクエストをそのプロキシ経由で送信する。
/// 社内ネットワークなどで直接アクセスできない環境向け。
pub struct WorkatoClient {
    pub client: Client,
    pub token: String,
    pub base_url: String,
    pub app: AppHandle,
}

impl WorkatoClient {
    /// 新しいクライアントを生成する。
    ///
    /// # 引数
    ///
    /// - `token` — Workato API トークン（Bearer 認証用）
    /// - `base_url` — API のベース URL（例: `https://app.trial.workato.com`）
    /// - `proxy_url` — HTTP プロキシ URL（`None` または空文字の場合はプロキシなし）
    /// - `app` — Tauri の [`AppHandle`]（ログ書き出しに使用）
    pub fn new(token: String, base_url: String, proxy_url: Option<String>, app: AppHandle) -> Self {
        let mut builder = Client::builder();
        if let Some(ref url) = proxy_url {
            if !url.is_empty() {
                if let Ok(p) = reqwest::Proxy::all(url) {
                    builder = builder.proxy(p);
                }
            }
        }
        WorkatoClient {
            client: builder.build().unwrap_or_else(|_| Client::new()),
            token,
            base_url,
            app,
        }
    }

    /// GET リクエストを送信する。
    ///
    /// `base_url` + `path` に対して Bearer 認証付きの GET リクエストを送り、
    /// レスポンスを [`ApiResponse`] として返す。
    /// リクエストの所要時間・ステータスコード・レスポンスボディ（先頭 500 文字）を
    /// ログに記録する。
    ///
    /// # エラー
    ///
    /// ネットワークエラーやレスポンスの読み取りに失敗した場合。
    pub async fn get(&self, path: &str) -> Result<ApiResponse, String> {
        let url = format!("{}{}", self.base_url, path);
        let start = std::time::Instant::now();
        let response = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.token))
            .send()
            .await
            .map_err(|e| {
                let elapsed = start.elapsed().as_millis();
                let msg = format!("GET {} -> ERROR ({elapsed}ms) {e}", path);
                logger::write_log(&self.app, &msg);
                e.to_string()
            })?;
        let elapsed = start.elapsed().as_millis();
        let status = response.status();
        let body = response.text().await.map_err(|e| e.to_string())?;
        let preview: String = body.chars().take(500).collect();
        logger::write_log(&self.app, &format!("GET {} -> {} ({elapsed}ms)\n  Body: {}", path, status.as_u16(), preview));
        Ok(ApiResponse { status, body })
    }

    /// PUT リクエストを送信する。
    ///
    /// `base_url` + `path` に対して Bearer 認証付きの PUT リクエストを送る。
    /// ボディは空で送信される（Workato のレシピ起動/停止 API 向け）。
    /// ログ出力の仕様は [`get`](Self::get) と同様。
    ///
    /// # エラー
    ///
    /// ネットワークエラーやレスポンスの読み取りに失敗した場合。
    pub async fn put(&self, path: &str) -> Result<ApiResponse, String> {
        let url = format!("{}{}", self.base_url, path);
        let start = std::time::Instant::now();
        let response = self.client
            .put(&url)
            .header("Authorization", format!("Bearer {}", self.token))
            .send()
            .await
            .map_err(|e| {
                let elapsed = start.elapsed().as_millis();
                let msg = format!("PUT {} -> ERROR ({elapsed}ms) {e}", path);
                logger::write_log(&self.app, &msg);
                e.to_string()
            })?;
        let elapsed = start.elapsed().as_millis();
        let status = response.status();
        let body = response.text().await.map_err(|e| e.to_string())?;
        let preview: String = body.chars().take(500).collect();
        logger::write_log(&self.app, &format!("PUT {} -> {} ({elapsed}ms)\n  Body: {}", path, status.as_u16(), preview));
        Ok(ApiResponse { status, body })
    }
}

/// 現在アクティブなプロファイルから [`WorkatoClient`] を生成する。
///
/// 設定ファイルから API トークン・ベース URL・プロキシ URL を読み込み、
/// 認証付きクライアントを返す。各リソースモジュールから共通で利用される。
///
/// # エラー
///
/// API トークンが未設定の場合。
pub fn make_client(app: &AppHandle) -> Result<WorkatoClient, String> {
    let config = load_config_internal(app)?;
    if config.api_token.is_empty() {
        return Err("API トークンが設定されていません。設定ページで入力してください。".to_string());
    }
    Ok(WorkatoClient::new(config.api_token, config.base_url, config.proxy_url, app.clone()))
}
