//! Gemini プロンプトの永続化。
//!
//! 保存済みプロンプトを `{app_data_dir}/gemini_prompts.json` に読み書きする。

use serde::{Deserialize, Serialize};
use std::fs;
use tauri::AppHandle;
use tauri::Manager;

/// 保存済みプロンプト。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedPrompt {
    pub name: String,
    pub content: String,
}

/// プロンプト保存先のパスを返す。
fn prompts_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir 取得失敗: {e}"))?;
    fs::create_dir_all(&base).map_err(|e| format!("ディレクトリ作成失敗: {e}"))?;
    Ok(base.join("gemini_prompts.json"))
}

/// 保存済みプロンプト一覧を読み込む。ファイルが無ければ空配列を返す。
#[tauri::command]
pub async fn load_gemini_prompts(app: AppHandle) -> Result<Vec<SavedPrompt>, String> {
    let path = prompts_path(&app)?;
    match fs::read_to_string(&path) {
        Ok(json) => {
            let prompts: Vec<SavedPrompt> =
                serde_json::from_str(&json).unwrap_or_default();
            Ok(prompts)
        }
        Err(_) => Ok(Vec::new()),
    }
}

/// プロンプト一覧をファイルに保存する。
#[tauri::command]
pub async fn save_gemini_prompts(
    app: AppHandle,
    prompts: Vec<SavedPrompt>,
) -> Result<(), String> {
    let path = prompts_path(&app)?;
    let json = serde_json::to_string_pretty(&prompts)
        .map_err(|e| format!("JSON シリアライズ失敗: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("プロンプトファイル書き出し失敗: {e}"))?;
    Ok(())
}
