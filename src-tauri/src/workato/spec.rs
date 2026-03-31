//! Workato API Platform 経由の仕様書生成。
//!
//! ファイルアップロード（Workato File API）後、
//! Workato API Platform のエンドポイントにリクエストを送り、
//! Dify ワークフローの実行結果（マークダウン仕様書 + DrawIO XML）を取得する。

use reqwest::Client;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::config::{load_workato_api_platform_config, load_workato_file_api_config};
use crate::logger;

/// Workato API Platform の実行結果。
#[derive(serde::Serialize, Clone)]
pub struct WorkatoSpecResult {
    /// Workato API Platform のレスポンスボディ（JSON文字列）
    pub response_json: String,
    /// ファイルアップロードのレスポンス
    pub file_upload_response: String,
    /// ファイルアップロードの curl コマンド
    pub file_upload_curl: String,
    /// ワークフロー実行の curl コマンド
    pub workflow_curl: String,
    /// ワークフロー実行のレスポンス
    pub workflow_response: String,
    /// リクエストボディ（表示用）
    pub request_body: String,
    /// HTTPステータスコード
    pub http_status: u16,
    /// エラーメッセージ
    pub error: Option<String>,
}

impl WorkatoSpecResult {
    fn empty() -> Self {
        WorkatoSpecResult {
            response_json: String::new(),
            file_upload_response: String::new(),
            file_upload_curl: String::new(),
            workflow_curl: String::new(),
            workflow_response: String::new(),
            request_body: String::new(),
            http_status: 0,
            error: None,
        }
    }
}

/// Workato File API にファイルをアップロードして file_id を取得する。
///
/// 既存の DifyClient::upload_file_workato と同等のロジックだが、
/// DifyClient に依存せず独立して動作する。
fn upload_file(app: &AppHandle, json_content: &str) -> Result<(String, String, String), String> {
    let wf_cfg = load_workato_file_api_config(app)?;

    // 一時ファイルに書き出す
    let tmp_dir = std::env::temp_dir();
    let tmp_path = tmp_dir.join("workato_spec_upload.json");
    std::fs::write(&tmp_path, json_content)
        .map_err(|e| format!("一時ファイルの書き込みに失敗: {}", e))?;
    let tmp_path_str = tmp_path.to_string_lossy().to_string();

    // curl コマンド構築
    let mut args: Vec<String> = vec![
        "-s".to_string(),
        "--connect-timeout".to_string(), "30".to_string(),
        "--max-time".to_string(), "300".to_string(),
        "-w".to_string(), "\n%{http_code}".to_string(),
        "-X".to_string(), "POST".to_string(),
        wf_cfg.url.to_string(),
        "-H".to_string(), format!("api-token: {}", wf_cfg.api_token),
        "-F".to_string(), format!("file=@{};type=application/json;filename=input.json", tmp_path_str),
    ];

    if wf_cfg.use_proxy {
        if let Some(ref proxy) = wf_cfg.proxy_url {
            if !proxy.is_empty() {
                args.push("--proxy".to_string());
                args.push(proxy.clone());
            }
        }
    }

    let display_curl = {
        let mut parts = vec!["curl".to_string()];
        for arg in &args {
            if arg.starts_with("api-token: ") {
                parts.push("\"api-token: ***\"".to_string());
            } else if arg.contains(' ') || arg.contains(';') || arg.contains('=') || arg.contains('@') {
                parts.push(format!("\"{}\"", arg));
            } else {
                parts.push(arg.clone());
            }
        }
        parts.join(" \\\n  ")
    };

    let mut cmd = std::process::Command::new("curl");
    cmd.args(&args);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd.output()
        .map_err(|e| format!("curl コマンドの実行に失敗: {}", e))?;

    let _ = std::fs::remove_file(&tmp_path);

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    let lines: Vec<&str> = stdout.trim().lines().collect();
    if lines.is_empty() {
        return Err(format!("curl の出力が空です。stderr: {}", stderr));
    }

    let http_status_str = lines[lines.len() - 1].trim();
    let response_body = lines[..lines.len() - 1].join("\n");
    let http_status: u16 = http_status_str.parse().unwrap_or(0);

    logger::write_log(app, &format!("Workato spec file upload -> {} Body: {}", http_status, response_body));

    if http_status < 200 || http_status >= 300 {
        return Err(format!("ファイルアップロード失敗 ({}): {}", http_status, response_body));
    }

    let file_id = response_body.trim().to_string();
    if file_id.is_empty() {
        return Err("レスポンスに file_id がありません".to_string());
    }

    Ok((file_id, response_body, display_curl))
}

/// Workato API Platform 仕様書生成コマンド。
///
/// 1. Workato File API でファイルをアップロード
/// 2. Workato API Platform にリクエストを送信
/// 3. レスポンス（マークダウン + DrawIO）を返す
#[tauri::command]
pub async fn workato_spec_run(
    app: AppHandle,
    json_content: String,
    doc_type: String,
    workato_flow_type: String,
    add_prompt: String,
    user: String,
) -> Result<WorkatoSpecResult, String> {
    let mut result = WorkatoSpecResult::empty();

    // フェーズ通知: ファイルアップロード開始
    let _ = app.emit("workato-spec-phase", "uploading");

    // 1. ファイルアップロード
    let (file_id, upload_response, upload_curl) = match upload_file(&app, &json_content) {
        Ok(r) => r,
        Err(e) => {
            result.error = Some(e);
            return Ok(result);
        }
    };
    result.file_upload_response = upload_response;
    result.file_upload_curl = upload_curl;

    // フェーズ通知: ワークフロー実行開始
    let _ = app.emit("workato-spec-phase", "workflow");

    // 2. Workato API Platform にリクエスト
    let api_cfg = load_workato_api_platform_config(&app)?;

    let body = serde_json::json!({
        "file_id": file_id,
        "type": doc_type,
        "workato_flow_type": workato_flow_type,
        "response_mode": "blocking",
        "user": user,
        "add_prompt": add_prompt,
    });
    let request_body_str = serde_json::to_string_pretty(&body).unwrap_or_default();
    result.request_body = request_body_str.clone();

    // 表示用 curl コマンド
    let workflow_curl = {
        let body_oneline = serde_json::to_string(&body).unwrap_or_default();
        format!(
            "curl -X POST \"{}\"\\\n  -H \"Content-Type: application/json\" \\\n  -H \"Accept: application/json\" \\\n  -H \"api-token: ***\" \\\n  -d '{}'",
            api_cfg.url, body_oneline
        )
    };
    result.workflow_curl = workflow_curl;

    let client = Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| format!("HTTP クライアントの生成に失敗: {}", e))?;

    let start = std::time::Instant::now();
    let response = match client
        .post(&api_cfg.url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .header("api-token", &api_cfg.api_token)
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            let elapsed = start.elapsed().as_millis();
            let msg = format!("Workato API Platform リクエスト失敗 ({}ms): {}", elapsed, e);
            logger::write_log(&app, &msg);
            result.error = Some(msg);
            return Ok(result);
        }
    };

    let status = response.status();
    result.http_status = status.as_u16();

    let response_body = match response.text().await {
        Ok(b) => b,
        Err(e) => {
            result.error = Some(format!("レスポンスの読み取りに失敗: {}", e));
            return Ok(result);
        }
    };
    let elapsed = start.elapsed().as_millis();

    logger::write_log(
        &app,
        &format!("Workato API Platform -> {} ({}ms)\n  Body: {}", status.as_u16(), elapsed, &response_body.chars().take(500).collect::<String>()),
    );

    result.workflow_response = response_body.clone();

    if !status.is_success() {
        result.response_json = response_body;
        result.error = Some(format!("Workato API Platform エラー ({})", status.as_u16()));
        return Ok(result);
    }

    result.response_json = response_body;
    Ok(result)
}
