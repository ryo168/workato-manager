//! Dify API クライアント。
//!
//! File Upload API でファイルをアップロードし、
//! Workflow Run API でワークフローを実行する。

use reqwest::Client;
use serde_json::Value;
use std::time::Duration;
use tauri::AppHandle;

use crate::config::load_dify_config;
use crate::logger;

/// Dify ワークフロー実行結果。
///
/// `result_json` は `serde_json::to_string()` で文字列化した JSON。
/// IPC で `Value` を直接送ると不正 JSON 由来のシリアライズエラーが起きるため、
/// 安全な String フィールドとして返す。
#[derive(serde::Serialize)]
pub struct DifyRunResult {
    pub result_json: String,
    pub request_body: String,
    pub response_body: String,
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

/// Dify API クライアント。
pub struct DifyClient {
    client: Client,
    base_url: String,
    api_key: String,
    user: String,
    file_input_name: String,
    doc_type_property_name: String,
    doc_type: i32,
    app: AppHandle,
}

impl DifyClient {
    /// 設定ファイルから Dify クライアントを生成する。
    pub fn from_config(app: &AppHandle) -> Result<Self, String> {
        let cfg = load_dify_config(app)?;
        let mut builder = Client::builder()
            .timeout(Duration::from_secs(300));
        if let Some(ref url) = cfg.proxy_url {
            if !url.is_empty() {
                if let Ok(p) = reqwest::Proxy::all(url) {
                    builder = builder.proxy(p);
                }
            }
        }
        Ok(DifyClient {
            client: builder.build().unwrap_or_else(|_| Client::new()),
            base_url: cfg.base_url,
            api_key: cfg.api_key,
            user: cfg.user,
            file_input_name: cfg.file_input_name,
            doc_type_property_name: cfg.doc_type_property_name,
            doc_type: cfg.doc_type,
            app: app.clone(),
        })
    }

    /// JSON 文字列を Dify にファイルとしてアップロードし、file_id を返す。
    async fn upload_file(&self, json_content: &str) -> Result<String, String> {
        let url = format!("{}/files/upload", self.base_url);

        let file_part = reqwest::multipart::Part::bytes(json_content.as_bytes().to_vec())
            .file_name("input.json")
            .mime_str("application/json")
            .map_err(|e| format!("multipart 構築エラー: {}", e))?;

        let form = reqwest::multipart::Form::new()
            .part("file", file_part)
            .text("user", self.user.clone());

        let start = std::time::Instant::now();
        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .multipart(form)
            .send()
            .await
            .map_err(|e| {
                let elapsed = start.elapsed().as_millis();
                let msg = format!("Dify upload -> ERROR ({elapsed}ms) {e}");
                logger::write_log(&self.app, &msg);
                format!("ファイルアップロードに失敗しました: {}", e)
            })?;

        let elapsed = start.elapsed().as_millis();
        let status = response.status();
        let body = response.text().await.map_err(|e| e.to_string())?;

        let preview: String = body.chars().take(500).collect();
        logger::write_log(
            &self.app,
            &format!("Dify upload -> {} ({elapsed}ms)\n  Body: {}", status.as_u16(), preview),
        );

        if !status.is_success() {
            return Err(format!("ファイルアップロード失敗 ({}): {}", status.as_u16(), body));
        }

        let parsed: Value = serde_json::from_str(&body)
            .map_err(|e| format!("アップロード応答の解析に失敗: {}", e))?;
        let file_id = parsed["id"]
            .as_str()
            .ok_or_else(|| "アップロード応答に id がありません".to_string())?
            .to_string();

        Ok(file_id)
    }

    /// ワークフローを streaming モードで実行し、(Value, request_body, response_body) を返す。
    ///
    /// SSE ストリームから `workflow_finished` イベントを読み取り、
    /// blocking モードと同等の形式 `{"data": {...}}` として返す。
    /// streaming にすることでリバースプロキシの gateway timeout (504) を回避する。
    async fn run_workflow(&self, file_id: &str) -> Result<(Value, String, String), String> {
        let url = format!("{}/workflows/run", self.base_url);

        let mut inputs = serde_json::Map::new();
        inputs.insert(
            self.file_input_name.clone(),
            serde_json::json!({
                "type": "custom",
                "transfer_method": "local_file",
                "upload_file_id": file_id
            }),
        );
        inputs.insert(
            self.doc_type_property_name.clone(),
            serde_json::Value::String(self.doc_type.to_string()),
        );
        let body = serde_json::json!({
            "inputs": inputs,
            "response_mode": "streaming",
            "user": &self.user
        });
        let request_body_str = serde_json::to_string_pretty(&body).unwrap_or_default();

        let start = std::time::Instant::now();
        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                let elapsed = start.elapsed().as_millis();
                let msg = format!("Dify workflow -> ERROR ({elapsed}ms) {e}");
                logger::write_log(&self.app, &msg);
                format!("ワークフロー実行に失敗しました: {}", e)
            })?;

        let status = response.status();
        if !status.is_success() {
            let elapsed = start.elapsed().as_millis();
            let err_body = response.text().await.map_err(|e| e.to_string())?;
            logger::write_log(
                &self.app,
                &format!("Dify workflow -> {} ({elapsed}ms)\n  Body: {}", status.as_u16(), err_body),
            );
            logger::write_dify_log(
                &self.app,
                &format!("=== REQUEST ===\n{}\n=== RESPONSE ({}) ===\n{}", request_body_str, status.as_u16(), err_body),
            );
            return Err(format!("ワークフロー実行失敗 ({}): {}", status.as_u16(), err_body));
        }

        let full_body = response.text().await.map_err(|e| e.to_string())?;
        let elapsed = start.elapsed().as_millis();

        // Dify ログにリクエスト・レスポンス全文を記録
        logger::write_dify_log(
            &self.app,
            &format!("=== REQUEST ===\n{}\n=== RESPONSE ({}) ({elapsed}ms) ===\n{}", request_body_str, status.as_u16(), full_body),
        );

        // --- フォールバック 1: plain JSON (blocking 互換レスポンス) ---
        // Dify がストリーミング要求を無視して通常 JSON を返すケースに対応。
        // parse_json_lenient で未エスケープ引用符も修復して解析する。
        if let Some(json) = parse_json_lenient(&full_body) {
            if json.get("data").is_some() {
                let preview: String = full_body.chars().take(500).collect();
                logger::write_log(
                    &self.app,
                    &format!("Dify workflow (plain JSON) -> {} ({elapsed}ms)\n  Body: {}", status.as_u16(), preview),
                );
                return Ok((json, request_body_str, full_body));
            }
        }

        // --- SSE パース ---
        // .lines() は \n と \r\n の両方を正しく処理する。
        // 空行をイベント区切りとし、各イベント内の data: 行を連結して
        // parse_json_lenient で解析する（XML 内の未エスケープ `"` に対応）。
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

                Ok((result, request_body_str, full_body))
            }
            None => {
                let preview: String = full_body.chars().take(1000).collect();
                logger::write_log(
                    &self.app,
                    &format!("Dify workflow -> {} ({elapsed}ms) workflow_finished not found\n  Raw: {}", status.as_u16(), preview),
                );
                Err(format!(
                    "ワークフローの完了イベントが見つかりませんでした。レスポンス先頭: {}",
                    full_body.chars().take(200).collect::<String>()
                ))
            }
        }
    }

    /// ファイルアップロード → ワークフロー実行を一括で行う。
    pub async fn execute(&self, json_content: &str) -> Result<(Value, String, String), String> {
        let file_id = self.upload_file(json_content).await?;
        self.run_workflow(&file_id).await
    }
}

/// Dify ワークフロー実行コマンド。
///
/// JSON 文字列を受け取り、Dify にアップロード後ワークフローを実行して結果を返す。
/// `DifyRunResult` で result_json / request_body / response_body を返す。
/// `Value` を直接返すと IPC シリアライズで不正 JSON 由来のエラーが起きるため、
/// `serde_json::to_string()` で文字列化した安全な String フィールドとして返す。
#[tauri::command]
pub async fn dify_run(app: AppHandle, json_content: String) -> Result<DifyRunResult, String> {
    let client = DifyClient::from_config(&app)?;
    let (value, request_body, response_body) = client.execute(&json_content).await?;
    let result_json = serde_json::to_string(&value)
        .map_err(|e| format!("結果の JSON シリアライズに失敗: {}", e))?;
    Ok(DifyRunResult {
        result_json,
        request_body,
        response_body,
    })
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
        // SSE イベントの data: 行を結合
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
    Ok(DifyRunResult {
        result_json,
        request_body: String::new(),
        response_body: raw,
    })
}
