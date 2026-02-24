//! 日付別ログファイルの書き出しと自動クリーンアップ。
//!
//! API リクエストの結果やエラー情報を日付別のログファイルに記録する。
//! ログは `{app_data_dir}/logs/` 配下に `YYYY-MM-DD.log` の形式で保存され、
//! 前日より古いファイルはアプリ起動時に自動削除される。
//!
//! ## ログのフォーマット
//!
//! ```text
//! [HH:MM:SS] メッセージ本文
//! ```

use std::fs;
use std::path::PathBuf;
use chrono::Local;
use tauri::{AppHandle, Manager};

/// ログファイルの保存ディレクトリを返す。
///
/// パスは `{app_data_dir}/logs/` となる。
/// ディレクトリが存在しない場合は呼び出し側で作成する必要がある。
pub fn log_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap().join("logs")
}

/// ログファイルに 1 行追記する。
///
/// 当日の日付に対応するファイル（`YYYY-MM-DD.log`）に
/// `[HH:MM:SS] {line}` の形式で書き出す。
/// ディレクトリやファイルが存在しない場合は自動作成される。
///
/// 書き込みに失敗した場合はエラーを黙殺する（ログ出力のためにアプリを落とさない）。
pub fn write_log(app: &AppHandle, line: &str) {
    let dir = log_dir(app);
    let _ = fs::create_dir_all(&dir);
    let now = Local::now();
    let file_name = now.format("%Y-%m-%d").to_string() + ".log";
    let path = dir.join(file_name);
    let entry = format!("[{}] {}\n", now.format("%H:%M:%S"), line);
    let _ = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .and_then(|mut f| std::io::Write::write_all(&mut f, entry.as_bytes()));
}

/// 前日より古いログファイルを削除する。
///
/// アプリ起動時（[`crate::run`] の `setup` 内）で 1 回だけ呼ばれる。
/// 当日と前日のログは保持し、それより古い `*.log` ファイルを削除する。
///
/// ファイル名が `YYYY-MM-DD.log` の形式でないものは無視される。
pub fn cleanup_old_logs(app: &AppHandle) {
    let dir = log_dir(app);
    if !dir.exists() {
        return;
    }
    let today = Local::now().date_naive();
    let yesterday = today - chrono::Duration::days(1);

    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if !name_str.ends_with(".log") {
            continue;
        }
        let date_part = &name_str[..name_str.len() - 4]; // strip ".log"
        if let Ok(file_date) = chrono::NaiveDate::parse_from_str(date_part, "%Y-%m-%d") {
            if file_date < yesterday {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}
