//! Dify API クライアント。
//!
//! File Upload API でファイルをアップロードし、
//! Workflow Run API でワークフローを実行する。
//!
//! ファイルアップロードは curl コマンドで実行する（プロキシ環境での
//! multipart ブロック回避）。ワークフロー実行は reqwest を使用。

use reqwest::Client;
use serde_json::Value;
use std::time::Duration;
use tauri::AppHandle;

use crate::config::{load_dify_config, load_workato_file_api_config};
use crate::logger;

/// Dify ワークフロー実行結果。
///
/// IPC で `Value` を直接送ると不正 JSON 由来のシリアライズエラーが起きるため、
/// 安全な String フィールドとして返す。
#[derive(serde::Serialize, Clone)]
pub struct DifyRunResult {
    pub result_json: String,
    pub file_upload_request: String,
    pub file_upload_response: String,
    pub workflow_request: String,
    pub workflow_response: String,
    pub file_upload_curl: String,
    pub workflow_curl: String,
    pub error: Option<String>,
    pub diagnostic_log: String,
}

impl DifyRunResult {
    fn empty() -> Self {
        DifyRunResult {
            result_json: String::new(),
            file_upload_request: String::new(),
            file_upload_response: String::new(),
            workflow_request: String::new(),
            workflow_response: String::new(),
            file_upload_curl: String::new(),
            workflow_curl: String::new(),
            error: None,
            diagnostic_log: String::new(),
        }
    }
}

/// Dify が返す不正な JSON（XML 内の `"` がエスケープされていない）を修復する。
///
/// JSON 文字列値の内部に含まれる未エスケープの `"` を `\"` に変換する。
/// 判定ロジック: `"` の直後（空白スキップ後）が `,` `}` `]` `:` または EOF なら
/// JSON 文字列の終端、それ以外なら未エスケープの内部引用符とみなす。
fn repair_json_quotes(input: &str) -> String {
    let bytes = input.as_bytes();
    let len = bytes.len();
    let mut out = Vec::with_capacity(len + 256);
    let mut i = 0;
    let mut in_string = false;

    while i < len {
        let b = bytes[i];

        if !in_string {
            out.push(b);
            if b == b'"' {
                in_string = true;
            }
            i += 1;
            continue;
        }

        // JSON 文字列の中
        if b == b'\\' {
            // エスケープシーケンス — そのまま 2 文字コピー
            out.push(b);
            if i + 1 < len {
                out.push(bytes[i + 1]);
                i += 2;
            } else {
                i += 1;
            }
            continue;
        }

        if b == b'"' {
            // 直後の非空白文字で JSON 境界かどうか判定
            let mut j = i + 1;
            while j < len && matches!(bytes[j], b' ' | b'\t' | b'\n' | b'\r') {
                j += 1;
            }
            let is_boundary = j >= len
                || matches!(bytes[j], b',' | b'}' | b']' | b':');

            if is_boundary {
                in_string = false;
                out.push(b'"');
            } else {
                // 未エスケープの内部 " → \" に変換
                out.push(b'\\');
                out.push(b'"');
            }
            i += 1;
            continue;
        }

        out.push(b);
        i += 1;
    }

    String::from_utf8(out).unwrap_or_else(|_| input.to_string())
}

/// JSON パース。失敗したら修復してリトライ。
fn parse_json_lenient(raw: &str) -> Option<Value> {
    if let Ok(v) = serde_json::from_str::<Value>(raw) {
        return Some(v);
    }
    let repaired = repair_json_quotes(raw);
    serde_json::from_str::<Value>(&repaired).ok()
}

/// ファイルアップロード結果（エラー時もpartialデータを保持）。
struct UploadResult {
    file_id: Option<String>,
    request_info: String,
    response_body: String,
    curl_cmd: String,
    diagnostic: String,
    error: Option<String>,
}

/// ワークフロー実行結果（エラー時もpartialデータを保持）。
struct WorkflowResult {
    value: Option<Value>,
    request_body: String,
    response_body: String,
    curl_cmd: String,
    error: Option<String>,
}

/// Dify API クライアント。
pub struct DifyClient {
    client: Client,
    base_url: String,
    api_key: String,
    user: String,
    file_input_name: String,
    proxy_url: Option<String>,
    use_proxy: bool,
    workato_file_id_param: String,
    param1_name: Option<String>,
    param1_value: Option<String>,
    param2_name: Option<String>,
    param2_value: Option<String>,
    param3_name: Option<String>,
    param3_value: Option<String>,
    param4_name: Option<String>,
    param4_value: Option<String>,
    file_api_mode: String,
    app: AppHandle,
}

impl DifyClient {
    /// 設定ファイルから Dify クライアントを生成する。
    pub fn from_config(app: &AppHandle) -> Result<Self, String> {
        let cfg = load_dify_config(app)?;
        let mut builder = Client::builder()
            .timeout(Duration::from_secs(300));
        if cfg.use_proxy {
            if let Some(ref url) = cfg.proxy_url {
                if !url.is_empty() {
                    if let Ok(p) = reqwest::Proxy::all(url) {
                        builder = builder.proxy(p);
                    }
                }
            }
        }
        Ok(DifyClient {
            client: builder.build().unwrap_or_else(|_| Client::new()),
            base_url: cfg.base_url,
            api_key: cfg.api_key,
            user: cfg.user,
            file_input_name: cfg.file_input_name,
            proxy_url: cfg.proxy_url,
            use_proxy: cfg.use_proxy,
            workato_file_id_param: cfg.workato_file_id_param,
            param1_name: cfg.param1_name,
            param1_value: cfg.param1_value,
            param2_name: cfg.param2_name,
            param2_value: cfg.param2_value,
            param3_name: cfg.param3_name,
            param3_value: cfg.param3_value,
            param4_name: cfg.param4_name,
            param4_value: cfg.param4_value,
            file_api_mode: cfg.file_api_mode,
            app: app.clone(),
        })
    }

    /// Workato File Proxy API にファイルをアップロードし、UploadResult を返す。
    ///
    /// curl で multipart/form-data として送信し、テキストで file_id を受け取る。
    fn upload_file_workato(&self, json_content: &str) -> UploadResult {
        let wf_cfg = match load_workato_file_api_config(&self.app) {
            Ok(c) => c,
            Err(e) => {
                return UploadResult {
                    file_id: None,
                    request_info: String::new(),
                    response_body: String::new(),
                    curl_cmd: String::new(),
                    diagnostic: String::new(),
                    error: Some(e),
                };
            }
        };
        let api_url = &wf_cfg.url;
        let api_token = &wf_cfg.api_token;

        let mut diagnostic = String::new();
        diagnostic.push_str(&format!("[workato-upload] URL: {}\n", api_url));
        diagnostic.push_str(&format!("[workato-upload] file size: {} bytes\n", json_content.len()));

        let request_info = format!(
            "POST {}\nContent-Type: multipart/form-data\nfile: input.json ({} bytes)",
            api_url, json_content.len()
        );

        // 一時ファイルに書き出す
        let tmp_dir = std::env::temp_dir();
        let tmp_path = tmp_dir.join("workato_upload_input.json");
        if let Err(e) = std::fs::write(&tmp_path, json_content) {
            return UploadResult {
                file_id: None,
                request_info,
                response_body: String::new(),
                curl_cmd: String::new(),
                diagnostic: format!("[workato-upload] ERROR: 一時ファイル書き込み失敗: {}\n", e),
                error: Some(format!("一時ファイルの書き込みに失敗: {}", e)),
            };
        }
        let tmp_path_str = tmp_path.to_string_lossy().to_string();

        // curl コマンド構築
        let mut args: Vec<String> = vec![
            "-s".to_string(),
            "--connect-timeout".to_string(), "30".to_string(),
            "--max-time".to_string(), "300".to_string(),
            "-w".to_string(), "\n%{http_code}".to_string(),
            "-X".to_string(), "POST".to_string(),
            api_url.to_string(),
            "-H".to_string(), format!("api-token: {}", api_token),
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

        let start = std::time::Instant::now();

        let mut cmd = std::process::Command::new("curl");
        cmd.args(&args);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }

        let output = match cmd.output() {
            Ok(o) => o,
            Err(e) => {
                let _ = std::fs::remove_file(&tmp_path);
                return UploadResult {
                    file_id: None,
                    request_info,
                    response_body: String::new(),
                    curl_cmd: display_curl,
                    diagnostic: format!("[workato-upload] ERROR: curl 実行失敗: {}\n", e),
                    error: Some(format!("curl コマンドの実行に失敗: {}", e)),
                };
            }
        };

        let elapsed = start.elapsed().as_millis();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        diagnostic.push_str(&format!("[workato-upload] elapsed: {}ms\n", elapsed));
        let _ = std::fs::remove_file(&tmp_path);

        let lines: Vec<&str> = stdout.trim().lines().collect();
        if lines.is_empty() {
            return UploadResult {
                file_id: None,
                request_info,
                response_body: String::new(),
                curl_cmd: display_curl,
                diagnostic: format!("{}\n[workato-upload] ERROR: curl 出力が空。stderr: {}\n", diagnostic, stderr),
                error: Some(format!("curl の出力が空です。stderr: {}", stderr)),
            };
        }

        let http_status_str = lines[lines.len() - 1].trim();
        let response_body = lines[..lines.len() - 1].join("\n");
        let http_status: u16 = http_status_str.parse().unwrap_or(0);

        diagnostic.push_str(&format!("[workato-upload] HTTP status: {}\n", http_status));

        logger::write_log(
            &self.app,
            &format!("Workato file upload -> {} ({}ms)\n  Body: {}", http_status, elapsed, response_body),
        );

        if http_status < 200 || http_status >= 300 {
            return UploadResult {
                file_id: None,
                request_info,
                response_body: response_body.clone(),
                curl_cmd: display_curl,
                diagnostic: format!("{}\n[workato-upload] ERROR: HTTP {}\n", diagnostic, http_status),
                error: Some(format!("Workato ファイルアップロード失敗 ({}): {}", http_status, response_body)),
            };
        }

        // レスポンスはテキストで file_id が返る
        let file_id = response_body.trim().to_string();
        if file_id.is_empty() {
            return UploadResult {
                file_id: None,
                request_info,
                response_body,
                curl_cmd: display_curl,
                diagnostic: format!("{}\n[workato-upload] ERROR: file_id が空\n", diagnostic),
                error: Some("レスポンスに file_id がありません".to_string()),
            };
        }

        diagnostic.push_str(&format!("[workato-upload] file_id: {}\n", file_id));

        UploadResult {
            file_id: Some(file_id),
            request_info,
            response_body,
            curl_cmd: display_curl,
            diagnostic,
            error: None,
        }
    }

    /// JSON 文字列を Dify にファイルとしてアップロードし、UploadResult を返す。
    ///
    /// curl コマンドを直接実行することでプロキシ環境での multipart ブロックを回避する。
    /// エラー時も curl コマンドやレスポンス等のpartialデータを保持して返す。
    fn upload_file(&self, json_content: &str) -> UploadResult {
        let url = format!("{}/files/upload", self.base_url);

        let mut diagnostic = String::new();
        diagnostic.push_str(&format!("[upload] URL: {}\n", url));
        diagnostic.push_str(&format!("[upload] file size: {} bytes\n", json_content.len()));

        // リクエスト情報（表示用）
        let request_info = format!(
            "POST {}\nContent-Type: multipart/form-data\nfile: input.json ({} bytes)\nuser: {}",
            url, json_content.len(), self.user
        );

        // 一時ファイルに JSON を書き出す
        let tmp_dir = std::env::temp_dir();
        let tmp_path = tmp_dir.join("dify_upload_input.json");
        if let Err(e) = std::fs::write(&tmp_path, json_content) {
            let msg = format!("一時ファイルの書き込みに失敗: {}", e);
            diagnostic.push_str(&format!("[upload] ERROR: {}\n", msg));
            return UploadResult {
                file_id: None,
                request_info,
                response_body: String::new(),
                curl_cmd: String::new(),
                diagnostic,
                error: Some(msg),
            };
        }
        let tmp_path_str = tmp_path.to_string_lossy().to_string();
        diagnostic.push_str(&format!("[upload] tmp file: {}\n", tmp_path_str));

        // curl コマンド構築
        let mut args: Vec<String> = vec![
            "-s".to_string(),
            "--connect-timeout".to_string(),
            "30".to_string(),
            "--max-time".to_string(),
            "300".to_string(),
            "-w".to_string(),
            "\n%{http_code}".to_string(),
            "-X".to_string(),
            "POST".to_string(),
            url.clone(),
            "-H".to_string(),
            format!("Authorization: Bearer {}", self.api_key),
            "-F".to_string(),
            format!("file=@{};type=application/json;filename=input.json", tmp_path_str),
            "-F".to_string(),
            format!("user={}", self.user),
        ];

        // プロキシ設定
        if self.use_proxy {
            if let Some(ref proxy) = self.proxy_url {
                if !proxy.is_empty() {
                    args.push("--proxy".to_string());
                    args.push(proxy.clone());
                }
            }
        }

        // 表示用 curl コマンド文字列（API キーはマスク）
        let display_curl = {
            let mut parts = vec!["curl".to_string()];
            for arg in &args {
                if arg.starts_with("Authorization: Bearer ") {
                    parts.push("\"Authorization: Bearer ***\"".to_string());
                } else if arg.contains(' ') || arg.contains(';') || arg.contains('=') || arg.contains('@') {
                    parts.push(format!("\"{}\"", arg));
                } else {
                    parts.push(arg.clone());
                }
            }
            parts.join(" \\\n  ")
        };

        let make_error = |msg: String, diag: String, resp: String| -> UploadResult {
            UploadResult {
                file_id: None,
                request_info: request_info.clone(),
                response_body: resp,
                curl_cmd: display_curl.clone(),
                diagnostic: diag,
                error: Some(msg),
            }
        };

        let start = std::time::Instant::now();

        // curl 実行
        let mut cmd = std::process::Command::new("curl");
        cmd.args(&args);

        // Windows: コンソールウィンドウを表示しない
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let output = match cmd.output() {
            Ok(o) => o,
            Err(e) => {
                let msg = format!("curl コマンドの実行に失敗: {}", e);
                diagnostic.push_str(&format!("[upload] ERROR: {}\n", msg));
                let _ = std::fs::remove_file(&tmp_path);
                return make_error(msg, diagnostic, String::new());
            }
        };

        let elapsed = start.elapsed().as_millis();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        diagnostic.push_str(&format!("[upload] elapsed: {}ms\n", elapsed));
        diagnostic.push_str(&format!("[upload] exit code: {:?}\n", output.status.code()));
        if !stderr.is_empty() {
            diagnostic.push_str(&format!("[upload] stderr: {}\n", stderr));
        }

        // 一時ファイル削除
        let _ = std::fs::remove_file(&tmp_path);

        // stdout の最後の行が HTTP ステータスコード
        let lines: Vec<&str> = stdout.trim().lines().collect();
        if lines.is_empty() {
            let msg = format!("curl の出力が空です。stderr: {}", stderr);
            diagnostic.push_str(&format!("[upload] ERROR: {}\n", msg));
            return make_error(msg, diagnostic, String::new());
        }
        let http_status_str = lines[lines.len() - 1].trim();
        let response_body = lines[..lines.len() - 1].join("\n");

        let http_status: u16 = http_status_str.parse().unwrap_or(0);
        diagnostic.push_str(&format!("[upload] HTTP status: {}\n", http_status));

        let preview: String = response_body.chars().take(500).collect();
        logger::write_log(
            &self.app,
            &format!("Dify upload (curl) -> {} ({elapsed}ms)\n  Body: {}", http_status, preview),
        );

        if http_status < 200 || http_status >= 300 {
            let msg = format!("ファイルアップロード失敗 ({}): {}", http_status, response_body);
            diagnostic.push_str(&format!("[upload] ERROR: {}\n", msg));
            return make_error(msg, diagnostic, response_body);
        }

        let parsed: Value = match serde_json::from_str(&response_body) {
            Ok(v) => v,
            Err(e) => {
                let msg = format!("アップロード応答の解析に失敗: {}", e);
                diagnostic.push_str(&format!("[upload] ERROR: {}\n", msg));
                return make_error(msg, diagnostic, response_body);
            }
        };
        let file_id = match parsed["id"].as_str() {
            Some(id) => id.to_string(),
            None => {
                let msg = "アップロード応答に id がありません".to_string();
                diagnostic.push_str(&format!("[upload] ERROR: {}\n", msg));
                return make_error(msg, diagnostic, response_body);
            }
        };

        diagnostic.push_str(&format!("[upload] file_id: {}\n", file_id));

        UploadResult {
            file_id: Some(file_id),
            request_info,
            response_body,
            curl_cmd: display_curl,
            diagnostic,
            error: None,
        }
    }

    /// ワークフローを streaming モードで実行し、WorkflowResult を返す。
    ///
    /// SSE ストリームから `workflow_finished` イベントを読み取り、
    /// blocking モードと同等の形式 `{"data": {...}}` として返す。
    /// streaming にすることでリバースプロキシの gateway timeout (504) を回避する。
    /// エラー時も curl コマンドやレスポンス等のpartialデータを保持して返す。
    async fn run_workflow(&self, file_id: &str) -> WorkflowResult {
        let url = format!("{}/workflows/run", self.base_url);

        let mut inputs = serde_json::Map::new();
        if self.file_api_mode == "workato" {
            // Workato モード: file_id を文字列パラメータとして送信
            inputs.insert(
                self.workato_file_id_param.clone(),
                serde_json::Value::String(file_id.to_string()),
            );
        } else {
            // Dify モード: Dify File API の形式で送信
            inputs.insert(
                self.file_input_name.clone(),
                serde_json::json!({
                    "type": "custom",
                    "transfer_method": "local_file",
                    "upload_file_id": file_id
                }),
            );
        }
        // カスタムパラメータ (1-4)
        let custom_params: [(&Option<String>, &Option<String>); 4] = [
            (&self.param1_name, &self.param1_value),
            (&self.param2_name, &self.param2_value),
            (&self.param3_name, &self.param3_value),
            (&self.param4_name, &self.param4_value),
        ];
        for (name, value) in &custom_params {
            if let (Some(n), Some(v)) = (name, value) {
                if !n.is_empty() {
                    inputs.insert(n.clone(), serde_json::Value::String(v.clone()));
                }
            }
        }
        let body = serde_json::json!({
            "inputs": inputs,
            "response_mode": "streaming",
            "user": &self.user
        });
        let request_body_str = serde_json::to_string_pretty(&body).unwrap_or_default();

        // 表示用 curl コマンド文字列（API キーはマスク、実行は reqwest）
        let curl_cmd = {
            let body_oneline = serde_json::to_string(&body).unwrap_or_default();
            let mut parts = vec![
                "curl".to_string(),
                "-s".to_string(),
                "-X POST".to_string(),
                format!("\"{}\"", url),
                "-H \"Authorization: Bearer ***\"".to_string(),
                "-H \"Content-Type: application/json\"".to_string(),
                format!("-d '{}'", body_oneline),
            ];
            if self.use_proxy {
                if let Some(ref proxy) = self.proxy_url {
                    if !proxy.is_empty() {
                        parts.push(format!("--proxy \"{}\"", proxy));
                    }
                }
            }
            parts.join(" \\\n  ")
        };

        let make_error = |msg: String, resp: String| -> WorkflowResult {
            WorkflowResult {
                value: None,
                request_body: request_body_str.clone(),
                response_body: resp,
                curl_cmd: curl_cmd.clone(),
                error: Some(msg),
            }
        };

        let start = std::time::Instant::now();
        let response = match self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                let elapsed = start.elapsed().as_millis();
                let msg = format!("Dify workflow -> ERROR ({elapsed}ms) {e}");
                logger::write_log(&self.app, &msg);
                return make_error(format!("ワークフロー実行に失敗しました: {}", e), String::new());
            }
        };

        let status = response.status();
        if !status.is_success() {
            let elapsed = start.elapsed().as_millis();
            let err_body = response.text().await.unwrap_or_default();
            logger::write_log(
                &self.app,
                &format!("Dify workflow -> {} ({elapsed}ms)\n  Body: {}", status.as_u16(), err_body),
            );
            logger::write_dify_log(
                &self.app,
                &format!("=== REQUEST ===\n{}\n=== RESPONSE ({}) ===\n{}", request_body_str, status.as_u16(), err_body),
            );
            return make_error(
                format!("ワークフロー実行失敗 ({}): {}", status.as_u16(), err_body),
                err_body,
            );
        }

        let full_body = match response.text().await {
            Ok(b) => b,
            Err(e) => {
                return make_error(format!("レスポンスの読み取りに失敗: {}", e), String::new());
            }
        };
        let elapsed = start.elapsed().as_millis();

        // Dify ログにリクエスト・レスポンス全文を記録
        logger::write_dify_log(
            &self.app,
            &format!("=== REQUEST ===\n{}\n=== RESPONSE ({}) ({elapsed}ms) ===\n{}", request_body_str, status.as_u16(), full_body),
        );

        // --- フォールバック 1: plain JSON (blocking 互換レスポンス) ---
        if let Some(json) = parse_json_lenient(&full_body) {
            if json.get("data").is_some() {
                let preview: String = full_body.chars().take(500).collect();
                logger::write_log(
                    &self.app,
                    &format!("Dify workflow (plain JSON) -> {} ({elapsed}ms)\n  Body: {}", status.as_u16(), preview),
                );
                return WorkflowResult {
                    value: Some(json),
                    request_body: request_body_str,
                    response_body: full_body,
                    curl_cmd,
                    error: None,
                };
            }
        }

        // --- SSE パース ---
        let mut finished_data: Option<Value> = None;
        let mut current_data = String::new();

        let try_parse_event = |data: &str, out: &mut Option<Value>| {
            if data.is_empty() {
                return;
            }
            if let Some(event) = parse_json_lenient(data) {
                if event.get("event").and_then(|v| v.as_str()) == Some("workflow_finished") {
                    *out = Some(event);
                }
            }
        };

        for line in full_body.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                try_parse_event(&current_data, &mut finished_data);
                current_data.clear();
                continue;
            }
            if let Some(rest) = trimmed.strip_prefix("data: ").or_else(|| trimmed.strip_prefix("data:")) {
                if !current_data.is_empty() {
                    current_data.push('\n');
                }
                current_data.push_str(rest);
            }
        }
        // 末尾に空行が無い場合の最後のイベント
        try_parse_event(&current_data, &mut finished_data);

        match finished_data {
            Some(event) => {
                // blocking モードと同じ形式 {"data": {...}} に変換
                let data = event.get("data").cloned().unwrap_or(event.clone());
                let result = serde_json::json!({ "data": data });

                let preview: String = serde_json::to_string(&result)
                    .unwrap_or_default().chars().take(500).collect();
                logger::write_log(
                    &self.app,
                    &format!("Dify workflow (SSE) -> {} ({elapsed}ms)\n  Body: {}", status.as_u16(), preview),
                );

                WorkflowResult {
                    value: Some(result),
                    request_body: request_body_str,
                    response_body: full_body,
                    curl_cmd,
                    error: None,
                }
            }
            None => {
                let preview: String = full_body.chars().take(1000).collect();
                logger::write_log(
                    &self.app,
                    &format!("Dify workflow -> {} ({elapsed}ms) workflow_finished not found\n  Raw: {}", status.as_u16(), preview),
                );
                let error_msg = format!(
                    "ワークフローの完了イベントが見つかりませんでした。レスポンス先頭: {}",
                    full_body.chars().take(200).collect::<String>()
                );
                WorkflowResult {
                    value: None,
                    request_body: request_body_str,
                    response_body: full_body,
                    curl_cmd,
                    error: Some(error_msg),
                }
            }
        }
    }

    /// ファイルアップロード → ワークフロー実行を一括で行い、DifyRunResult を返す。
    ///
    /// エラーが発生した場合でも途中までの結果（curlコマンド・レスポンス等）を
    /// DifyRunResult に詰めて返す。
    pub async fn execute(&self, json_content: &str) -> DifyRunResult {
        let mut result = DifyRunResult::empty();

        // 1. ファイルアップロード（モードに応じて分岐）
        let upload = if self.file_api_mode == "workato" {
            self.upload_file_workato(json_content)
        } else {
            self.upload_file(json_content)
        };
        result.file_upload_request = upload.request_info;
        result.file_upload_response = upload.response_body;
        result.file_upload_curl = upload.curl_cmd;
        result.diagnostic_log = upload.diagnostic;

        let file_id = match upload.file_id {
            Some(id) => id,
            None => {
                result.error = upload.error;
                return result;
            }
        };

        // 2. ワークフロー実行
        let wf = self.run_workflow(&file_id).await;
        result.workflow_request = wf.request_body;
        result.workflow_response = wf.response_body;
        result.workflow_curl = wf.curl_cmd;

        if let Some(ref e) = wf.error {
            result.error = Some(e.clone());
        }

        // result_json を設定
        if let Some(value) = wf.value {
            match serde_json::to_string(&value) {
                Ok(json) => result.result_json = json,
                Err(e) => {
                    result.error = Some(format!("結果の JSON シリアライズに失敗: {}", e));
                }
            }
        }

        result
    }
}

/// Dify ワークフロー実行コマンド。
///
/// JSON 文字列を受け取り、Dify にアップロード後ワークフローを実行して結果を返す。
/// エラー時も partial データを含む `DifyRunResult` を返す。
#[tauri::command]
pub async fn dify_run(app: AppHandle, json_content: String) -> Result<DifyRunResult, String> {
    let client = DifyClient::from_config(&app)?;
    let result = client.execute(&json_content).await;
    // 常に Ok で返す（エラー時も partial データを保持するため）
    Ok(result)
}

/// ファイルアップロードのみ実行するコマンド（開発者モード用）。
///
/// ワークフローは実行せず、アップロード結果だけを返す。
#[tauri::command]
pub async fn dify_upload_only(app: AppHandle, json_content: String) -> Result<DifyRunResult, String> {
    let client = DifyClient::from_config(&app)?;
    let mut result = DifyRunResult::empty();

    let upload = if client.file_api_mode == "workato" {
        client.upload_file_workato(&json_content)
    } else {
        client.upload_file(&json_content)
    };

    result.file_upload_request = upload.request_info;
    result.file_upload_response = upload.response_body;
    result.file_upload_curl = upload.curl_cmd;
    result.diagnostic_log = upload.diagnostic;

    if let Some(ref e) = upload.error {
        result.error = Some(e.clone());
    }

    if let Some(id) = upload.file_id {
        result.result_json = format!("{{\"file_id\":\"{}\"}}", id);
    }

    Ok(result)
}

/// ファイルダイアログで JSON ファイルを選択し、parse_json_lenient で修復してから返す。
///
/// Dify API を呼ばずに保存済みレスポンスをテストするためのコマンド。
/// SSE 形式（`data: {...}` で始まるファイル）にも対応する。
/// ユーザーがキャンセルした場合はエラーを返す。
#[tauri::command]
pub async fn dify_load_response() -> Result<DifyRunResult, String> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("JSON", &["json"])
        .set_title("Dify レスポンスファイルを選択")
        .pick_file()
        .await
        .ok_or_else(|| "ファイルが選択されませんでした".to_string())?;

    let file_path = file.path().to_string_lossy().to_string();
    let raw = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("ファイル読み込みに失敗: {}", e))?;

    // SSE 形式（"data: {...}"）の場合、data: プレフィックスを除去して JSON 部分を抽出
    let json_str = if raw.trim_start().starts_with("data: ") || raw.trim_start().starts_with("data:") {
        let mut data_parts = String::new();
        for line in raw.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("data: ").or_else(|| trimmed.strip_prefix("data:")) {
                if !data_parts.is_empty() {
                    data_parts.push('\n');
                }
                data_parts.push_str(rest);
            }
        }
        data_parts
    } else {
        raw.clone()
    };

    let value = parse_json_lenient(&json_str)
        .ok_or_else(|| "JSON の解析に失敗しました（修復後も無効）".to_string())?;

    // SSE イベント（workflow_finished）の場合、data フィールドを抽出して blocking 形式に変換
    let result_value = if value.get("event").is_some() {
        let data = value.get("data").cloned().unwrap_or(value.clone());
        serde_json::json!({ "data": data })
    } else {
        value
    };

    let result_json = serde_json::to_string(&result_value)
        .map_err(|e| format!("JSON シリアライズに失敗: {}", e))?;

    let mut result = DifyRunResult::empty();
    result.result_json = result_json;
    result.workflow_response = raw;
    Ok(result)
}
