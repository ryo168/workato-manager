//! 汎用 Tauri コマンド。
//!
//! Workato API とは直接関係のない、ファイル保存やパス取得など
//! OS・アプリ基盤に関わるコマンドをまとめている。

use tauri::{AppHandle, Manager};

use crate::logger;

/// ログファイルの保存ディレクトリのパスを返す。
///
/// `invoke("get_log_dir")` で呼び出される。
/// ディレクトリが存在しない場合は自動作成する。
///
/// # エラー
///
/// `app_data_dir` の取得やディレクトリ作成に失敗した場合。
#[tauri::command]
pub fn get_log_dir(app: AppHandle) -> Result<String, String> {
    let dir = logger::log_dir(&app);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

/// 設定ファイルの保存ディレクトリのパスを返す。
///
/// `invoke("get_config_dir")` で呼び出される。
/// ディレクトリが存在しない場合は自動作成する。
///
/// # エラー
///
/// `app_data_dir` の取得やディレクトリ作成に失敗した場合。
#[tauri::command]
pub fn get_config_dir(app: AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

/// 指定パスのフォルダを Windows エクスプローラーで開く。
///
/// `invoke("open_folder", { path })` で呼び出される。
/// フロントエンドの「フォルダを開く」ボタンから使用される。
///
/// # エラー
///
/// `explorer` コマンドの起動に失敗した場合。
#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// CSV ファイルを「名前を付けて保存」ダイアログで書き出す。
///
/// `invoke("save_csv_file", { suggestedName, content })` で呼び出される。
/// ファイルダイアログで保存先を選択し、`content` をそのまま書き込む。
///
/// # 戻り値
///
/// - `Ok(true)` — 保存成功
/// - `Ok(false)` — ユーザーがダイアログをキャンセルした
///
/// # エラー
///
/// ファイルの書き込みに失敗した場合。
#[tauri::command]
pub async fn save_csv_file(suggested_name: String, content: String) -> Result<bool, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_file_name(&suggested_name)
        .add_filter("CSV", &["csv"])
        .save_file()
        .await;

    match file {
        Some(handle) => {
            std::fs::write(handle.path(), content.as_bytes()).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

/// JSON ファイルを「名前を付けて保存」ダイアログで書き出す。
///
/// `invoke("save_json_file", { suggestedName, content })` で呼び出される。
/// ファイルダイアログで保存先を選択し、`content` をそのまま書き込む。
///
/// # 戻り値
///
/// - `Ok(true)` — 保存成功
/// - `Ok(false)` — ユーザーがダイアログをキャンセルした
///
/// # エラー
///
/// ファイルの書き込みに失敗した場合。
#[tauri::command]
pub async fn save_json_file(suggested_name: String, content: String) -> Result<bool, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_file_name(&suggested_name)
        .add_filter("JSON", &["json"])
        .save_file()
        .await;

    match file {
        Some(handle) => {
            std::fs::write(handle.path(), content.as_bytes()).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}
