//! Dify 実行履歴の永続化。
//!
//! 実行結果（マークダウン・draw.io XML）をローカルファイルに保存し、
//! 一覧表示・詳細取得・削除を行う。

use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

/// 保持する最大履歴件数。超過分は古い順に削除。
const MAX_ENTRIES: usize = 50;

/// 履歴メタファイル名。
const META_FILE: &str = "history.json";

// ---------------------------------------------------------------------------
// 構造体
// ---------------------------------------------------------------------------

/// 一覧用の履歴エントリ。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub timestamp: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub elapsed_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<u64>,
    pub has_markdown: bool,
    pub has_drawio: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

/// 詳細取得時のレスポンス。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryDetail {
    pub entry: HistoryEntry,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub markdown: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drawio: Option<String>,
}

/// 履歴ストア（JSON ファイルに保存）。
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct HistoryStore {
    entries: Vec<HistoryEntry>,
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/// 履歴保存ディレクトリ（`<app_data>/dify_history`）。
fn history_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir 取得失敗: {e}"))?;
    let dir = base.join("dify_history");
    fs::create_dir_all(&dir).map_err(|e| format!("ディレクトリ作成失敗: {e}"))?;
    Ok(dir)
}

/// メタファイルを読み込む。ファイルが無ければ空ストアを返す。
fn load_store(dir: &PathBuf) -> HistoryStore {
    let path = dir.join(META_FILE);
    match fs::read_to_string(&path) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => HistoryStore::default(),
    }
}

/// メタファイルに書き出す。
fn save_store(dir: &PathBuf, store: &HistoryStore) -> Result<(), String> {
    let path = dir.join(META_FILE);
    let json = serde_json::to_string_pretty(store)
        .map_err(|e| format!("JSON シリアライズ失敗: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("メタファイル書き出し失敗: {e}"))?;
    Ok(())
}

/// エントリ ID に対応するサブディレクトリ。
fn entry_dir(base: &PathBuf, id: &str) -> PathBuf {
    base.join(id)
}

/// MAX_ENTRIES を超えた古いエントリを削除する。
fn trim_old_entries(dir: &PathBuf, store: &mut HistoryStore) {
    while store.entries.len() > MAX_ENTRIES {
        if let Some(old) = store.entries.pop() {
            let d = entry_dir(dir, &old.id);
            let _ = fs::remove_dir_all(&d);
        }
    }
}

// ---------------------------------------------------------------------------
// Tauri コマンド
// ---------------------------------------------------------------------------

/// 実行結果を履歴に保存する。
#[tauri::command]
pub async fn save_history_entry(
    app: AppHandle,
    status: String,
    error: Option<String>,
    elapsed_time: Option<f64>,
    total_tokens: Option<u64>,
    markdown: Option<String>,
    drawio: Option<String>,
    source: Option<String>,
) -> Result<String, String> {
    let dir = history_dir(&app)?;
    let now = Local::now();
    let id = now.format("%Y%m%d_%H%M%S_%3f").to_string();
    let timestamp = now.format("%Y-%m-%d %H:%M:%S").to_string();

    let has_markdown = markdown.as_ref().map_or(false, |s| !s.trim().is_empty());
    let has_drawio = drawio.as_ref().map_or(false, |s| !s.trim().is_empty());

    // サブディレクトリを作成してファイルを書き出す
    let edir = entry_dir(&dir, &id);
    fs::create_dir_all(&edir).map_err(|e| format!("エントリディレクトリ作成失敗: {e}"))?;

    if let Some(ref md) = markdown {
        if !md.trim().is_empty() {
            fs::write(edir.join("output.md"), md)
                .map_err(|e| format!("MD ファイル書き出し失敗: {e}"))?;
        }
    }
    if let Some(ref dx) = drawio {
        if !dx.trim().is_empty() {
            fs::write(edir.join("output.drawio"), dx)
                .map_err(|e| format!("DrawIO ファイル書き出し失敗: {e}"))?;
        }
    }

    let entry = HistoryEntry {
        id: id.clone(),
        timestamp,
        status,
        error,
        elapsed_time,
        total_tokens,
        has_markdown,
        has_drawio,
        source,
    };

    let mut store = load_store(&dir);
    store.entries.insert(0, entry);
    trim_old_entries(&dir, &mut store);
    save_store(&dir, &store)?;

    Ok(id)
}

/// 履歴一覧を返す（新しい順）。
#[tauri::command]
pub async fn load_history_list(app: AppHandle) -> Result<Vec<HistoryEntry>, String> {
    let dir = history_dir(&app)?;
    let store = load_store(&dir);
    Ok(store.entries)
}

/// 指定 ID の履歴詳細を返す。
#[tauri::command]
pub async fn load_history_detail(app: AppHandle, id: String) -> Result<HistoryDetail, String> {
    let dir = history_dir(&app)?;
    let store = load_store(&dir);

    let entry = store
        .entries
        .iter()
        .find(|e| e.id == id)
        .cloned()
        .ok_or_else(|| format!("履歴が見つかりません: {id}"))?;

    let edir = entry_dir(&dir, &id);

    let markdown = if entry.has_markdown {
        fs::read_to_string(edir.join("output.md")).ok()
    } else {
        None
    };

    let drawio = if entry.has_drawio {
        fs::read_to_string(edir.join("output.drawio")).ok()
    } else {
        None
    };

    Ok(HistoryDetail {
        entry,
        markdown,
        drawio,
    })
}

/// 指定 ID の履歴を削除する。
#[tauri::command]
pub async fn delete_history_entry(app: AppHandle, id: String) -> Result<(), String> {
    let dir = history_dir(&app)?;
    let mut store = load_store(&dir);

    store.entries.retain(|e| e.id != id);
    save_store(&dir, &store)?;

    let edir = entry_dir(&dir, &id);
    if edir.exists() {
        fs::remove_dir_all(&edir).map_err(|e| format!("エントリ削除失敗: {e}"))?;
    }

    Ok(())
}
