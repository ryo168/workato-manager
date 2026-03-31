//! Workato REST API のクライアントとリソース操作。
//!
//! Workato のレシピ・ジョブ・コネクション・フォルダ・プロジェクトを操作する
//! Tauri コマンド群を提供する。
//!
//! ## サブモジュール
//!
//! | モジュール | 対応する API リソース |
//! |---|---|
//! | [`client`] | HTTP クライアント（認証・ログ・プロキシ） |
//! | [`recipes`] | レシピの一覧取得・起動・停止 |
//! | [`jobs`] | レシピに紐づくジョブ（実行履歴）の取得 |
//! | [`connections`] | コネクション（外部サービス接続）の一覧取得 |
//! | [`folders`] | フォルダ・プロジェクトの取得、プロジェクト配下レシピの再帰取得 |

pub mod client;
pub mod recipes;
pub mod jobs;
pub mod connections;
pub mod folders;
pub mod spec;
