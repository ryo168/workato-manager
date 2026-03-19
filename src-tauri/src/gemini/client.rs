//! Gemini API クライアント。
//!
//! プロンプトと JSON を送信し、マークダウンテキストを生成する。

use reqwest::Client;
use serde_json::Value;
use std::time::Duration;
use tauri::AppHandle;

use crate::config::load_gemini_config;
use crate::logger;

/// Gemini API 実行結果。
#[derive(serde::Serialize, Clone)]
pub struct GeminiRunResult {
    /// 生成されたマークダウンテキスト
    pub markdown: String,
    /// プロンプトトークン数
    pub prompt_tokens: Option<i64>,
    /// 生成トークン数
    pub completion_tokens: Option<i64>,
    /// 合計トークン数
    pub total_tokens: Option<i64>,
    /// 使用モデル名
    pub model: String,
    /// 実行時間（ミリ秒）
    pub elapsed_ms: u64,
    /// リクエストボディ（デバッグ用）
    pub request_body: String,
    /// レスポンスボディ（デバッグ用）
    pub response_body: String,
    /// エラーメッセージ
    pub error: Option<String>,
}

impl GeminiRunResult {
    fn error(model: &str, elapsed_ms: u64, request_body: String, response_body: String, error: String) -> Self {
        GeminiRunResult {
            markdown: String::new(),
            prompt_tokens: None,
            completion_tokens: None,
            total_tokens: None,
            model: model.to_string(),
            elapsed_ms,
            request_body,
            response_body,
            error: Some(error),
        }
    }
}

/// Gemini API クライアント。
pub struct GeminiClient {
    client: Client,
    api_key: String,
    model: String,
    app: AppHandle,
}

impl GeminiClient {
    /// 設定ファイルから Gemini クライアントを生成する。
    pub fn from_config(app: &AppHandle) -> Result<Self, String> {
        let cfg = load_gemini_config(app)?;
        let mut builder = Client::builder().timeout(Duration::from_secs(300));
        if cfg.use_proxy {
            if let Some(ref url) = cfg.proxy_url {
                if !url.is_empty() {
                    if let Ok(p) = reqwest::Proxy::all(url) {
                        builder = builder.proxy(p);
                    }
                }
            }
        }
        Ok(GeminiClient {
            client: builder.build().unwrap_or_else(|_| Client::new()),
            api_key: cfg.api_key,
            model: cfg.model,
            app: app.clone(),
        })
    }

    /// プロンプトと JSON を送信してマークダウンを生成する。
    pub async fn generate(&self, prompt: &str, json_content: &str) -> GeminiRunResult {
        let full_prompt = format!(
            "{}\n\n以下のJSON情報:\n```json\n{}\n```",
            prompt, json_content
        );

        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            self.model, self.api_key
        );

        let body = serde_json::json!({
            "contents": [{
                "parts": [{"text": full_prompt}]
            }],
            "generationConfig": {
                "temperature": 0.0,
                "topP": 0.8
            }
        });

        let request_body_str = serde_json::to_string_pretty(&body).unwrap_or_default();
        let start = std::time::Instant::now();

        // API 呼び出し
        let response = match self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                let elapsed = start.elapsed().as_millis() as u64;
                let msg = format!("Gemini API 呼び出しに失敗: {}", e);
                logger::write_log(&self.app, &format!("Gemini {} -> ERROR ({}ms) {}", self.model, elapsed, e));
                return GeminiRunResult::error(&self.model, elapsed, request_body_str, String::new(), msg);
            }
        };

        let status = response.status();
        let response_text = response.text().await.unwrap_or_default();
        let elapsed = start.elapsed().as_millis() as u64;

        let preview: String = response_text.chars().take(500).collect();
        logger::write_log(
            &self.app,
            &format!("Gemini {} -> {} ({}ms)\n  Body: {}", self.model, status.as_u16(), elapsed, preview),
        );

        if !status.is_success() {
            let msg = format!("Gemini API エラー ({}): {}", status.as_u16(), response_text);
            return GeminiRunResult::error(&self.model, elapsed, request_body_str, response_text, msg);
        }

        // レスポンス解析
        let parsed: Value = match serde_json::from_str(&response_text) {
            Ok(v) => v,
            Err(e) => {
                let msg = format!("レスポンスの解析に失敗: {}", e);
                return GeminiRunResult::error(&self.model, elapsed, request_body_str, response_text, msg);
            }
        };

        // candidates[0].content.parts[0].text からマークダウンを抽出
        let markdown = parsed
            .get("candidates")
            .and_then(|c| c.get(0))
            .and_then(|c| c.get("content"))
            .and_then(|c| c.get("parts"))
            .and_then(|p| p.get(0))
            .and_then(|p| p.get("text"))
            .and_then(|t| t.as_str())
            .unwrap_or("")
            .to_string();

        // usageMetadata からトークン数を抽出
        let usage = parsed.get("usageMetadata");
        let prompt_tokens = usage
            .and_then(|u| u.get("promptTokenCount"))
            .and_then(|v| v.as_i64());
        let completion_tokens = usage
            .and_then(|u| u.get("candidatesTokenCount"))
            .and_then(|v| v.as_i64());
        let total_tokens = usage
            .and_then(|u| u.get("totalTokenCount"))
            .and_then(|v| v.as_i64());

        if markdown.is_empty() {
            let msg = "レスポンスにテキストが含まれていません".to_string();
            return GeminiRunResult::error(&self.model, elapsed, request_body_str, response_text, msg);
        }

        GeminiRunResult {
            markdown,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            model: self.model.clone(),
            elapsed_ms: elapsed,
            request_body: request_body_str,
            response_body: response_text,
            error: None,
        }
    }
}

/// Gemini API 実行コマンド。
///
/// プロンプトと JSON 文字列を受け取り、Gemini でマークダウンを生成して返す。
#[tauri::command]
pub async fn gemini_run(
    app: AppHandle,
    prompt: String,
    json_content: String,
) -> Result<GeminiRunResult, String> {
    let client = GeminiClient::from_config(&app)?;
    Ok(client.generate(&prompt, &json_content).await)
}
