//! アプリケーション設定（プロファイル）の永続化。
//!
//! 設定は `app_data_dir/config.json` に JSON 形式で保存される。
//! 複数プロファイルに対応しており、各プロファイルが 1 つの Workato 接続先に対応する。
//!
//! ## 旧フォーマットとの互換性
//!
//! v0.x 時代はトップレベルに `api_token` / `base_url` を直書きしていた。
//! [`load_raw_config`] はこの旧フォーマットを検出すると、自動的に
//! `"Default"` プロファイルとしてラップして返す。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// API 接続先ごとの認証・接続情報。
///
/// フロントエンドの設定画面で追加・編集される。
///
/// # フィールド
///
/// - `name` — プロファイルの識別名（ユニーク）
/// - `api_token` — Workato API トークン（Bearer 認証に使用）
/// - `base_url` — Workato API のベース URL（例: `https://app.trial.workato.com`）
/// - `proxy_url` — HTTP プロキシ URL（社内ネットワーク向け、省略可）
#[derive(Serialize, Deserialize, Clone)]
pub struct Profile {
    pub name: String,
    pub api_token: String,
    pub base_url: String,
    #[serde(default)]
    pub proxy_url: Option<String>,
}

/// アプリケーション全体の設定。
///
/// 複数の [`Profile`] を保持し、`active_profile` でどれが現在有効かを指定する。
#[derive(Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub profiles: Vec<Profile>,
    pub active_profile: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            profiles: vec![Profile {
                name: "Default".to_string(),
                api_token: "".to_string(),
                base_url: "https://app.trial.workato.com".to_string(),
                proxy_url: None,
            }],
            active_profile: "Default".to_string(),
        }
    }
}

/// 現在アクティブなプロファイルから取り出した接続情報。
///
/// [`load_config_internal`] が返す内部用の構造体。
/// [`WorkatoClient`](crate::workato::client::WorkatoClient) の生成に使われる。
pub struct ActiveConfig {
    pub api_token: String,
    pub base_url: String,
    pub proxy_url: Option<String>,
}

/// 設定ファイルのパスを返す。
///
/// `{app_data_dir}/config.json` を指す。
fn config_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap()
        .join("config.json")
}

/// 設定ファイルを読み込み、[`AppConfig`] として返す。
///
/// - ファイルが存在しない場合はデフォルト設定を返す。
/// - 旧フォーマット（`profiles` キーが無い）の場合は自動的に移行する。
fn load_raw_config(app: &AppHandle) -> Result<AppConfig, String> {
    let path = config_path(app);
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&json).map_err(|e| e.to_string())?;

    // 旧フォーマットからの移行（トップレベルに api_token/base_url があった時代）
    if value.get("profiles").is_none() {
        let api_token = value
            .get("api_token")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let base_url = value
            .get("base_url")
            .and_then(|v| v.as_str())
            .unwrap_or("https://app.trial.workato.com")
            .to_string();
        return Ok(AppConfig {
            profiles: vec![Profile {
                name: "Default".to_string(),
                api_token,
                base_url,
                proxy_url: None,
            }],
            active_profile: "Default".to_string(),
        });
    }

    serde_json::from_value(value).map_err(|e| e.to_string())
}

/// 現在アクティブなプロファイルの接続情報を取得する。
///
/// 各 API コマンド（[`get_recipes`](crate::workato::recipes::get_recipes) 等）が
/// [`WorkatoClient`](crate::workato::client::WorkatoClient) を生成する際に呼び出す。
///
/// # エラー
///
/// `active_profile` に一致するプロファイルが見つからない場合はエラーを返す。
pub fn load_config_internal(app: &AppHandle) -> Result<ActiveConfig, String> {
    let cfg = load_raw_config(app)?;
    let p = cfg
        .profiles
        .iter()
        .find(|p| p.name == cfg.active_profile)
        .ok_or_else(|| "アクティブプロファイルが見つかりません".to_string())?;
    Ok(ActiveConfig {
        api_token: p.api_token.clone(),
        base_url: p.base_url.clone(),
        proxy_url: p.proxy_url.clone(),
    })
}

/// フロントエンドから設定を読み込む Tauri コマンド。
///
/// `invoke("load_config")` で呼び出される。
/// 全プロファイル情報を含む [`AppConfig`] を返す。
#[tauri::command]
pub fn load_config(app: AppHandle) -> Result<AppConfig, String> {
    load_raw_config(&app)
}

/// フロントエンドから設定を保存する Tauri コマンド。
///
/// `invoke("save_config", { profiles, activeProfile })` で呼び出される。
/// プロファイル一覧とアクティブプロファイル名を受け取り、
/// `config.json` に書き出す。
#[tauri::command]
pub fn save_config(
    app: AppHandle,
    profiles: Vec<Profile>,
    active_profile: String,
) -> Result<(), String> {
    let config = AppConfig {
        profiles,
        active_profile,
    };
    let path = config_path(&app);
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}
