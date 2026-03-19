//! # Workato Manager
//!
//! Workato の REST API を操作するデスクトップアプリケーションのバックエンド。
//! Tauri フレームワーク上で動作し、フロントエンド（React）からの `invoke` 呼び出しを処理する。
//!
//! ## モジュール構成
//!
//! | モジュール | 役割 |
//! |---|---|
//! | `config` | プロファイル（接続先）の読み書き |
//! | `logger` | 日付別ログファイルの書き出しと古いログの自動削除 |
//! | `commands` | ファイル保存・パス取得など汎用コマンド |
//! | `workato` | Workato API クライアントとリソース操作（レシピ・ジョブ・コネクション・フォルダ） |
//!
//! ## フロントエンドとの通信
//!
//! フロントエンドは `@tauri-apps/api/core` の `invoke()` を通じて
//! `#[tauri::command]` が付いた関数を呼び出す。
//! 登録は [`run()`] 内の `invoke_handler` で行っている。

mod commands;
mod config;
mod dify;
mod gemini;
mod logger;
mod workato;

/// Tauri アプリケーションを構築して起動する。
///
/// 起動時に以下の処理を行う:
/// - `tauri_plugin_opener` プラグインの初期化
/// - 古いログファイルの削除（`logger::cleanup_old_logs`）
/// - 全コマンドハンドラの登録
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            logger::cleanup_old_logs(&app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::save_config,
            config::load_config,
            workato::recipes::get_recipes,
            workato::recipes::get_recipes_by_ids,
            workato::recipes::start_recipe,
            workato::recipes::stop_recipe,
            workato::jobs::get_jobs,
            workato::connections::get_connections,
            workato::folders::get_folders,
            workato::folders::get_projects,
            workato::folders::get_project_recipes,
            dify::client::dify_run,
            dify::client::dify_upload_only,
            dify::client::dify_load_response,
            dify::history::save_history_entry,
            dify::history::load_history_list,
            dify::history::load_history_detail,
            dify::history::delete_history_entry,
            gemini::client::gemini_run,
            gemini::prompts::load_gemini_prompts,
            gemini::prompts::save_gemini_prompts,
            commands::save_csv_file,
            commands::save_json_file,
            commands::save_markdown_file,
            commands::save_drawio_file,
            commands::get_log_dir,
            commands::get_config_dir,
            commands::open_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
