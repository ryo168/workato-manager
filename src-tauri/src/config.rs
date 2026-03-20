//! アプリケーション設定（プロファイル）の永続化。
//!
//! 設定は `app_data_dir/config.json` に JSON 形式で保存される。
//! 複数プロファイルに対応しており、各プロファイルが 1 つの Workato 接続先に対応する。
//! Dify も同様に複数プロファイル方式をサポートする。
//!
//! ## 旧フォーマットとの互換性
//!
//! v0.x 時代はトップレベルに `api_token` / `base_url` を直書きしていた。
//! [`load_raw_config`] はこの旧フォーマットを検出すると、自動的に
//! `"Default"` プロファイルとしてラップして返す。
//! また、フラットな `dify_*` フィールド形式も `DifyProfile` に変換する。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Workato API 接続先ごとの認証・接続情報。
///
/// フロントエンドの設定画面で追加・編集される。
///
/// # フィールド
///
/// - `name` — プロファイルの識別名（ユニーク）
/// - `api_token` — Workato API トークン（Bearer 認証に使用）
/// - `base_url` — Workato API のベース URL（例: `https://app.trial.workato.com`）
#[derive(Serialize, Deserialize, Clone)]
pub struct Profile {
    pub name: String,
    pub api_token: String,
    pub base_url: String,
    #[serde(default)]
    pub use_proxy: Option<bool>,
}

/// Dify API 接続先ごとの設定情報。
///
/// Workato の [`Profile`] と同様に複数プロファイルをサポートする。
///
/// # フィールド
///
/// - `name` — プロファイルの識別名（ユニーク）
/// - `base_url` — Dify API のベース URL（例: `https://api.dify.ai/v1`）
/// - `api_key` — Dify API キー
/// - `user` — ユーザー識別子（省略時は `"default-user"`）
/// - `file_input_name` — ファイル入力変数名（省略時は `"file"`）
#[derive(Serialize, Deserialize, Clone)]
pub struct DifyProfile {
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    #[serde(default)]
    pub user: Option<String>,
    #[serde(default)]
    pub file_input_name: Option<String>,
    #[serde(default)]
    pub markdown_output_name: Option<String>,
    #[serde(default)]
    pub drawio_output_name: Option<String>,
    #[serde(default)]
    pub doc_type_property_name: Option<String>,
    #[serde(default)]
    pub doc_type: Option<i32>,
    /// Workato モード時の file_id 入力変数名
    #[serde(default)]
    pub workato_file_id_param: Option<String>,
    /// カスタムパラメータ1（名前）
    #[serde(default)]
    pub param1_name: Option<String>,
    /// カスタムパラメータ1（値）
    #[serde(default)]
    pub param1_value: Option<String>,
    /// カスタムパラメータ2（名前）
    #[serde(default)]
    pub param2_name: Option<String>,
    /// カスタムパラメータ2（値）
    #[serde(default)]
    pub param2_value: Option<String>,
    /// カスタムパラメータ3（名前）
    #[serde(default)]
    pub param3_name: Option<String>,
    /// カスタムパラメータ3（値）
    #[serde(default)]
    pub param3_value: Option<String>,
    /// カスタムパラメータ4（名前）
    #[serde(default)]
    pub param4_name: Option<String>,
    /// カスタムパラメータ4（値）
    #[serde(default)]
    pub param4_value: Option<String>,
    /// ファイルAPI モード: "dify"（デフォルト）または "workato"
    #[serde(default)]
    pub file_api_mode: Option<String>,
    #[serde(default)]
    pub use_proxy: Option<bool>,
}

/// Workato File API 接続先ごとの設定情報。
///
/// Dify のファイルアップロードを Workato File Proxy API 経由で行う場合に使用する。
///
/// # フィールド
///
/// - `name` — プロファイルの識別名（ユニーク）
/// - `url` — Workato File Proxy API の URL
/// - `api_token` — API トークン
#[derive(Serialize, Deserialize, Clone)]
pub struct WorkatoFileApiProfile {
    pub name: String,
    pub url: String,
    pub api_token: String,
    #[serde(default)]
    pub use_proxy: Option<bool>,
}

/// Gemini API 接続先ごとの設定情報。
///
/// # フィールド
///
/// - `name` — プロファイルの識別名（ユニーク）
/// - `api_key` — Gemini API キー
/// - `model` — 使用するモデル名（省略時は `"gemini-2.5-flash"`）
#[derive(Serialize, Deserialize, Clone)]
pub struct GeminiProfile {
    pub name: String,
    pub api_key: String,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub use_proxy: Option<bool>,
}

/// アプリケーション全体の設定。
///
/// 複数の [`Profile`]、[`DifyProfile`]、[`GeminiProfile`] を保持し、
/// それぞれ `active_*` でどれが現在有効かを指定する。
/// `proxy_url` は全サービス共通のプロキシ設定。
#[derive(Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub profiles: Vec<Profile>,
    pub active_profile: String,
    #[serde(default)]
    pub dify_profiles: Vec<DifyProfile>,
    #[serde(default)]
    pub active_dify_profile: String,
    #[serde(default)]
    pub gemini_profiles: Vec<GeminiProfile>,
    #[serde(default)]
    pub active_gemini_profile: String,
    #[serde(default)]
    pub workato_file_api_profiles: Vec<WorkatoFileApiProfile>,
    #[serde(default)]
    pub active_workato_file_api_profile: String,
    #[serde(default)]
    pub proxy_url: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            profiles: vec![Profile {
                name: "Default".to_string(),
                api_token: "".to_string(),
                base_url: "https://app.trial.workato.com".to_string(),
                use_proxy: None,
            }],
            active_profile: "Default".to_string(),
            dify_profiles: vec![],
            active_dify_profile: "".to_string(),
            gemini_profiles: vec![],
            active_gemini_profile: "".to_string(),
            workato_file_api_profiles: vec![],
            active_workato_file_api_profile: "".to_string(),
            proxy_url: None,
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
    pub use_proxy: bool,
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
/// - フラットな `dify_*` フィールド形式も `dify_profiles` に変換する。
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
                use_proxy: None,
            }],
            active_profile: "Default".to_string(),
            dify_profiles: vec![],
            active_dify_profile: "".to_string(),
            gemini_profiles: vec![],
            active_gemini_profile: "".to_string(),
            workato_file_api_profiles: vec![],
            active_workato_file_api_profile: "".to_string(),
            proxy_url: None,
        });
    }

    // まず serde でデシリアライズ
    let mut config: AppConfig = serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;

    // 旧フラット dify_* フィールドからの移行
    if config.dify_profiles.is_empty() {
        let dify_base_url = value.get("dify_base_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let dify_api_key = value.get("dify_api_key").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if !dify_base_url.is_empty() && !dify_api_key.is_empty() {
            let dify_user = value.get("dify_user").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let dify_file_input_name = value.get("dify_file_input_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let profile = DifyProfile {
                name: "Default".to_string(),
                base_url: dify_base_url,
                api_key: dify_api_key,
                user: if dify_user.is_empty() { None } else { Some(dify_user) },
                file_input_name: if dify_file_input_name.is_empty() { None } else { Some(dify_file_input_name) },
                markdown_output_name: None,
                drawio_output_name: None,
                doc_type_property_name: None,
                doc_type: None,
                workato_file_id_param: None,
                param1_name: None,
                param1_value: None,
                param2_name: None,
                param2_value: None,
                param3_name: None,
                param3_value: None,
                param4_name: None,
                param4_value: None,
                file_api_mode: None,
                use_proxy: None,
            };
            config.dify_profiles = vec![profile];
            config.active_dify_profile = "Default".to_string();
        }
    }

    // 旧 Profile.proxy_url からの移行（最初に見つかった非空値をトップレベルに昇格）
    if config.proxy_url.is_none() {
        if let Some(proxy) = value.get("profiles")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.iter().find_map(|p| {
                p.get("proxy_url").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(|s| s.to_string())
            }))
        {
            config.proxy_url = Some(proxy);
        }
    }

    Ok(config)
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
        proxy_url: cfg.proxy_url.clone(),
        use_proxy: p.use_proxy.unwrap_or(false),
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
/// `invoke("save_config", { profiles, activeProfile, difyProfiles, activeDifyProfile, proxyUrl })`
/// で呼び出される。
#[tauri::command]
pub fn save_config(
    app: AppHandle,
    profiles: Vec<Profile>,
    active_profile: String,
    dify_profiles: Vec<DifyProfile>,
    active_dify_profile: String,
    gemini_profiles: Vec<GeminiProfile>,
    active_gemini_profile: String,
    workato_file_api_profiles: Vec<WorkatoFileApiProfile>,
    active_workato_file_api_profile: String,
    proxy_url: Option<String>,
) -> Result<(), String> {
    let config = AppConfig {
        profiles,
        active_profile,
        dify_profiles,
        active_dify_profile,
        gemini_profiles,
        active_gemini_profile,
        workato_file_api_profiles,
        active_workato_file_api_profile,
        proxy_url,
    };
    let path = config_path(&app);
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

/// Dify の設定情報。
///
/// [`load_dify_config`] が返す内部用の構造体。
/// [`DifyClient`](crate::dify::client::DifyClient) の生成に使われる。
pub struct DifyConfig {
    pub base_url: String,
    pub api_key: String,
    pub user: String,
    pub file_input_name: String,
    pub markdown_output_name: String,
    pub drawio_output_name: String,
    pub doc_type_property_name: String,
    pub doc_type: i32,
    pub proxy_url: Option<String>,
    pub workato_file_id_param: String,
    pub param1_name: Option<String>,
    pub param1_value: Option<String>,
    pub param2_name: Option<String>,
    pub param2_value: Option<String>,
    pub param3_name: Option<String>,
    pub param3_value: Option<String>,
    pub param4_name: Option<String>,
    pub param4_value: Option<String>,
    /// "dify" or "workato"
    pub file_api_mode: String,
    pub use_proxy: bool,
}

/// Dify 設定を取得する。
///
/// `dify_profiles` からアクティブなプロファイルを探して [`DifyConfig`] を返す。
///
/// # エラー
///
/// アクティブな Dify プロファイルが見つからない場合はエラーを返す。
pub fn load_dify_config(app: &AppHandle) -> Result<DifyConfig, String> {
    let cfg = load_raw_config(app)?;
    let profile = cfg
        .dify_profiles
        .iter()
        .find(|p| p.name == cfg.active_dify_profile)
        .ok_or_else(|| "Dify プロファイルが設定されていません。設定ページで追加してください。".to_string())?;

    if profile.base_url.is_empty() {
        return Err("Dify API URL が設定されていません。設定ページで入力してください。".to_string());
    }
    if profile.api_key.is_empty() {
        return Err("Dify API キーが設定されていません。設定ページで入力してください。".to_string());
    }

    let user = profile.user.as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("default-user")
        .to_string();
    let file_input_name = profile.file_input_name.as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("file")
        .to_string();
    let markdown_output_name = profile.markdown_output_name.as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("text")
        .to_string();
    let drawio_output_name = profile.drawio_output_name.as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("drawio_xml")
        .to_string();
    let doc_type_property_name = profile.doc_type_property_name.as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("doc_type")
        .to_string();
    let doc_type = profile.doc_type.unwrap_or(1);
    let file_api_mode = profile.file_api_mode.as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("dify")
        .to_string();

    Ok(DifyConfig {
        base_url: profile.base_url.clone(),
        api_key: profile.api_key.clone(),
        user,
        file_input_name,
        markdown_output_name,
        drawio_output_name,
        doc_type_property_name,
        doc_type,
        proxy_url: cfg.proxy_url.clone(),
        workato_file_id_param: profile.workato_file_id_param.as_deref()
            .filter(|s| !s.is_empty())
            .unwrap_or("workato_file_id")
            .to_string(),
        param1_name: profile.param1_name.clone(),
        param1_value: profile.param1_value.clone(),
        param2_name: profile.param2_name.clone(),
        param2_value: profile.param2_value.clone(),
        param3_name: profile.param3_name.clone(),
        param3_value: profile.param3_value.clone(),
        param4_name: profile.param4_name.clone(),
        param4_value: profile.param4_value.clone(),
        file_api_mode,
        use_proxy: profile.use_proxy.unwrap_or(false),
    })
}

/// Gemini の設定情報。
///
/// [`load_gemini_config`] が返す内部用の構造体。
/// [`GeminiClient`](crate::gemini::client::GeminiClient) の生成に使われる。
pub struct GeminiConfig {
    pub api_key: String,
    pub model: String,
    pub proxy_url: Option<String>,
    pub use_proxy: bool,
}

/// Gemini 設定を取得する。
///
/// `gemini_profiles` からアクティブなプロファイルを探して [`GeminiConfig`] を返す。
pub fn load_gemini_config(app: &AppHandle) -> Result<GeminiConfig, String> {
    let cfg = load_raw_config(app)?;
    let profile = cfg
        .gemini_profiles
        .iter()
        .find(|p| p.name == cfg.active_gemini_profile)
        .ok_or_else(|| "Gemini プロファイルが設定されていません。設定ページで追加してください。".to_string())?;

    if profile.api_key.is_empty() {
        return Err("Gemini API キーが設定されていません。設定ページで入力してください。".to_string());
    }

    let model = profile.model.as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("gemini-2.5-flash")
        .to_string();

    Ok(GeminiConfig {
        api_key: profile.api_key.clone(),
        model,
        proxy_url: cfg.proxy_url.clone(),
        use_proxy: profile.use_proxy.unwrap_or(false),
    })
}

/// Workato File API の設定情報。
///
/// [`load_workato_file_api_config`] が返す内部用の構造体。
pub struct WorkatoFileApiConfig {
    pub url: String,
    pub api_token: String,
    pub use_proxy: bool,
    pub proxy_url: Option<String>,
}

/// Workato File API 設定を取得する。
///
/// `workato_file_api_profiles` からアクティブなプロファイルを探して [`WorkatoFileApiConfig`] を返す。
pub fn load_workato_file_api_config(app: &AppHandle) -> Result<WorkatoFileApiConfig, String> {
    let cfg = load_raw_config(app)?;
    let profile = cfg
        .workato_file_api_profiles
        .iter()
        .find(|p| p.name == cfg.active_workato_file_api_profile)
        .ok_or_else(|| "Workato File API プロファイルが設定されていません。設定ページで追加してください。".to_string())?;

    if profile.url.is_empty() {
        return Err("Workato File API の URL が設定されていません。設定ページで入力してください。".to_string());
    }
    if profile.api_token.is_empty() {
        return Err("Workato File API のトークンが設定されていません。設定ページで入力してください。".to_string());
    }

    Ok(WorkatoFileApiConfig {
        url: profile.url.clone(),
        api_token: profile.api_token.clone(),
        use_proxy: profile.use_proxy.unwrap_or(false),
        proxy_url: cfg.proxy_url.clone(),
    })
}
