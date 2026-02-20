use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone)]
pub struct Profile {
    pub name: String,
    pub api_token: String,
    pub base_url: String,
    #[serde(default)]
    pub proxy_url: Option<String>,
}

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

pub struct ActiveConfig {
    pub api_token: String,
    pub base_url: String,
    pub proxy_url: Option<String>,
}

fn config_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap()
        .join("config.json")
}

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

#[tauri::command]
pub fn load_config(app: AppHandle) -> Result<AppConfig, String> {
    load_raw_config(&app)
}

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
