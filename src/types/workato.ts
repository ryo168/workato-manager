// Workato API のレスポンス型。Rust 側が返す JSON に対応してる。

/** レシピ内のコネクション設定エントリ。レシピが利用するコネクションの参照情報を保持する。 */
export interface RecipeConfigEntry {
  /** コネクション設定のキーワード識別子 */
  keyword?: string;
  /** コネクション設定の表示名 */
  name?: string;
  /** コネクションプロバイダー名（例: "salesforce", "slack"） */
  provider?: string;
  /** 紐づくコネクションID。文字列・数値どちらも返り得る。null は未設定 */
  account_id?: number | string | null;
}

/** Workato レシピ。ワークフローの定義と実行状態を表す。 */
export interface Recipe {
  /** レシピの一意識別子 */
  id: number;
  /** レシピ名 */
  name: string;
  /** 実行状態。true=稼働中, false=停止中, null=状態不明 */
  running: boolean | null;
  /** レシピの説明文 */
  description?: string;
  /** 最終実行日時（ISO 8601） */
  last_run_at?: string;
  /** 作成日時（ISO 8601） */
  created_at?: string;
  /** 更新日時（ISO 8601） */
  updated_at?: string;
  /** 停止日時（ISO 8601） */
  stopped_at?: string;
  /** ジョブ成功回数 */
  job_succeeded_count?: number;
  /** ジョブ失敗回数 */
  job_failed_count?: number;
  /** 所属フォルダID */
  folder_id?: number;
  /** 所属プロジェクトID */
  project_id?: number;
  /** トリガーに使用しているアプリケーション名 */
  trigger_application?: string;
  /** レシピが使用するコネクション設定の一覧 */
  config: RecipeConfigEntry[];
  /** レシピのコード定義（JSON構造） */
  code?: Record<string, unknown>;
}

/** ジョブ。レシピの実行履歴 1 件を表す。 */
export interface Job {
  /** ジョブの一意識別子 */
  id: string;
  /** ジョブのタイトル（トリガーイベントの概要） */
  title?: string;
  /** エラー発生フラグ。true=エラー終了 */
  is_error?: boolean;
  /** ジョブ開始日時（ISO 8601） */
  started_at?: string;
  /** ジョブ完了日時（ISO 8601） */
  completed_at?: string;
  /** エラーメッセージ（エラー時のみ） */
  error?: string;
}

/** Workato コネクション。外部サービスとの認証接続情報を表す。 */
export interface Connection {
  /** コネクションの一意識別子 */
  id: number;
  /** コネクション名 */
  name: string;
  /** 接続先アプリケーション名（例: "salesforce"） */
  application?: string;
  /** 認証ステータス。"success"=認証OK */
  authorization_status?: string;
  /** 認証完了日時（ISO 8601） */
  authorized_at?: string;
  /** 作成日時（ISO 8601） */
  created_at?: string;
  /** 更新日時（ISO 8601） */
  updated_at?: string;
  /** 所属フォルダID */
  folder_id?: number;
  /** 所属プロジェクトID */
  project_id?: number;
}

/** Workato フォルダ。レシピやコネクションを整理するためのフォルダ。 */
export interface Folder {
  /** フォルダの一意識別子 */
  id: number;
  /** フォルダ名 */
  name: string;
  /** 親フォルダID。省略時はルート直下 */
  parent_id?: number;
  /** 作成日時（ISO 8601） */
  created_at?: string;
  /** 更新日時（ISO 8601） */
  updated_at?: string;
}

/** Workato プロジェクト。フォルダ配下のリソースをまとめる論理グループ。 */
export interface Project {
  /** プロジェクトの一意識別子 */
  id: number;
  /** プロジェクト名 */
  name: string;
  /** プロジェクトの説明文 */
  description?: string;
  /** プロジェクトが属するフォルダID */
  folder_id: number;
}

/** Workato API プロファイル。接続先ごとの認証情報を保持する。 */
export interface Profile {
  /** プロファイル名（一意の識別名） */
  name: string;
  /** プロファイルの説明文 */
  description?: string;
  /** Workato API トークン */
  api_token: string;
  /** Workato API のベースURL（例: "https://www.workato.com/api"） */
  base_url: string;
  /** プロキシを使用するかどうか。省略時は false 扱い */
  use_proxy?: boolean;
}

/** Dify API プロファイル。Dify ワークフローとの連携設定を保持する。 */
export interface DifyProfile {
  /** プロファイル名（一意の識別名） */
  name: string;
  /** プロファイルの説明文 */
  description?: string;
  /** Dify API のベースURL */
  base_url: string;
  /** Dify API キー */
  api_key: string;
  /** Dify ワークフロー実行時のユーザー識別子 */
  user?: string;
  /** ファイルアップロード時の入力パラメータ名（Difyワークフロー側で定義した名前） */
  file_input_name?: string;
  /** ワークフロー出力からマークダウンを取得するための出力キー名 */
  markdown_output_name?: string;
  /** ワークフロー出力から drawio XML を取得するための出力キー名 */
  drawio_output_name?: string;
  /** ドキュメント種別を指定するワークフロー入力パラメータ名 */
  doc_type_property_name?: string;
  /** ドキュメント種別の値（数値で指定） */
  doc_type?: number;
  /** Workato File API のファイルIDを渡すワークフロー入力パラメータ名 */
  workato_file_id_param?: string;
  /** カスタムパラメータ1の名前。ワークフローに追加の入力値を渡す際に使用 */
  param1_name?: string;
  /** カスタムパラメータ1の値 */
  param1_value?: string;
  /** カスタムパラメータ2の名前。ワークフローに追加の入力値を渡す際に使用 */
  param2_name?: string;
  /** カスタムパラメータ2の値 */
  param2_value?: string;
  /** カスタムパラメータ3の名前。ワークフローに追加の入力値を渡す際に使用 */
  param3_name?: string;
  /** カスタムパラメータ3の値 */
  param3_value?: string;
  /** カスタムパラメータ4の名前。ワークフローに追加の入力値を渡す際に使用 */
  param4_name?: string;
  /** カスタムパラメータ4の値 */
  param4_value?: string;
  /** ファイルアップロードのモード。"dify"=Dify標準API経由, "workato"=Workato File API経由 */
  file_api_mode?: string;
  /** 本番モード。true の場合 inputs ラップなしのフラットなリクエストボディを送信する */
  production_mode?: boolean;
  /** プロキシを使用するかどうか。省略時は false 扱い */
  use_proxy?: boolean;
}

/** Dify ワークフローパラメータ。dify_workflow_config.json に保存される。 */
export interface DifyWorkflowParam {
  /** 紐づく Dify プロファイル名 */
  profile_name: string;
  file_input_name?: string;
  markdown_output_name?: string;
  drawio_output_name?: string;
  doc_type_property_name?: string;
  doc_type?: number;
  workato_file_id_param?: string;
  param1_name?: string;
  param1_value?: string;
  param2_name?: string;
  param2_value?: string;
  param3_name?: string;
  param3_value?: string;
  param4_name?: string;
  param4_value?: string;
  file_api_mode?: string;
}

/** Workato File API プロファイル。Workato File API との連携設定を保持する。 */
export interface WorkatoFileApiProfile {
  /** プロファイル名（一意の識別名） */
  name: string;
  /** プロファイルの説明文 */
  description?: string;
  /** Workato File API のエンドポイントURL */
  url: string;
  /** Workato File API のAPIトークン */
  api_token: string;
  /** プロキシを使用するかどうか。省略時は false 扱い */
  use_proxy?: boolean;
}

/** Workato API Platform プロファイル。Workato API Platform 経由の仕様書生成設定を保持する。 */
export interface WorkatoApiPlatformProfile {
  /** プロファイル名（一意の識別名） */
  name: string;
  /** プロファイルの説明文 */
  description?: string;
  /** Workato API Platform のエンドポイントURL */
  url: string;
  /** Workato API Platform のAPIトークン */
  api_token: string;
}

/** Gemini API プロファイル。Google Gemini との連携設定を保持する。 */
export interface GeminiProfile {
  /** プロファイル名（一意の識別名） */
  name: string;
  /** プロファイルの説明文 */
  description?: string;
  /** Gemini API キー */
  api_key: string;
  /** 使用する Gemini モデル名（例: "gemini-2.0-flash"）。省略時はデフォルトモデルを使用 */
  model?: string;
  /** プロキシを使用するかどうか。省略時は false 扱い */
  use_proxy?: boolean;
}

/** アプリ設定。全プロファイル一覧・アクティブプロファイル・共通プロキシ設定を保持する。 */
export interface AppConfig {
  /** Workato API プロファイル一覧 */
  profiles: Profile[];
  /** 現在アクティブな Workato API プロファイル名 */
  active_profile: string;
  /** Dify API プロファイル一覧 */
  dify_profiles: DifyProfile[];
  /** 現在アクティブな Dify API プロファイル名 */
  active_dify_profile: string;
  /** Gemini API プロファイル一覧 */
  gemini_profiles: GeminiProfile[];
  /** 現在アクティブな Gemini API プロファイル名 */
  active_gemini_profile: string;
  /** Workato File API プロファイル一覧 */
  workato_file_api_profiles: WorkatoFileApiProfile[];
  /** 現在アクティブな Workato File API プロファイル名 */
  active_workato_file_api_profile: string;
  /** Workato API Platform プロファイル一覧 */
  workato_api_platform_profiles: WorkatoApiPlatformProfile[];
  /** 現在アクティブな Workato API Platform プロファイル名 */
  active_workato_api_platform_profile: string;
  /** 共通プロキシURL。use_proxy が true のプロファイルで使用される */
  proxy_url?: string;
}

/** Dify ワークフロー実行結果。Rust 側の DifyRunResult に対応する。 */
export interface DifyRunResult {
  /** ワークフロー実行結果の JSON 文字列 */
  result_json: string;
  /** ファイルアップロードリクエストの内容（デバッグ用） */
  file_upload_request: string;
  /** ファイルアップロードレスポンスの内容（デバッグ用） */
  file_upload_response: string;
  /** ワークフロー実行リクエストの内容（デバッグ用） */
  workflow_request: string;
  /** ワークフロー実行レスポンスの内容（デバッグ用） */
  workflow_response: string;
  /** ファイルアップロードの curl 再現コマンド */
  file_upload_curl: string;
  /** ワークフロー実行の curl 再現コマンド */
  workflow_curl: string;
  /** エラーメッセージ（エラー発生時のみ） */
  error?: string;
  /** 診断ログ（トラブルシューティング用の詳細情報） */
  diagnostic_log?: string;
}

/** Dify ワークフロー結果のパース後構造。result_json をパースした結果を扱いやすくしたもの。 */
export interface WorkflowResult {
  /** パース前の生データ */
  raw: unknown;
  /** ワークフロー実行ステータス（例: "succeeded", "failed"） */
  status: string;
  /** ワークフローの出力データ */
  outputs: unknown;
  /** ワークフロー実行の所要時間（秒） */
  elapsed_time?: number;
  /** 使用した合計トークン数 */
  total_tokens?: number;
  /** エラーメッセージ（失敗時のみ） */
  error?: string;
}

/** Workato API Platform 仕様書生成結果。Rust 側の WorkatoSpecResult に対応する。 */
export interface WorkatoSpecResult {
  /** Workato API Platform のレスポンスボディ（JSON文字列） */
  response_json: string;
  /** ファイルアップロードのレスポンス */
  file_upload_response: string;
  /** ファイルアップロードの curl コマンド */
  file_upload_curl: string;
  /** ワークフロー実行の curl コマンド */
  workflow_curl: string;
  /** ワークフロー実行のレスポンス */
  workflow_response: string;
  /** リクエストボディ（表示用） */
  request_body: string;
  /** HTTPステータスコード */
  http_status: number;
  /** エラーメッセージ */
  error?: string;
}

/** Workato 仕様書生成パラメータ。プロファイルごとの設定。 */
export interface WorkatoSpecParam {
  profile_name: string;
  doc_type?: string;
  workato_flow_type?: string;
  add_prompt?: string;
  user?: string;
}

/** Gemini API 実行結果。Rust 側の GeminiRunResult に対応する。 */
export interface GeminiRunResult {
  /** 生成されたマークダウンテキスト */
  markdown: string;
  /** プロンプトの入力トークン数 */
  prompt_tokens?: number;
  /** 生成された出力トークン数 */
  completion_tokens?: number;
  /** 合計トークン数 */
  total_tokens?: number;
  /** 使用した Gemini モデル名 */
  model: string;
  /** 実行時間（ミリ秒） */
  elapsed_ms: number;
  /** API リクエストボディの JSON 文字列（デバッグ用） */
  request_body: string;
  /** API レスポンスボディの JSON 文字列（デバッグ用） */
  response_body: string;
  /** エラーメッセージ（エラー発生時のみ） */
  error?: string;
}

/** 保存済みプロンプト。Gemini 等で再利用するためのプロンプトテンプレート。 */
export interface SavedPrompt {
  /** プロンプト名（一意の識別名） */
  name: string;
  /** プロンプトの本文 */
  content: string;
}

/** Dify/Gemini 実行履歴エントリ。履歴一覧に表示する概要情報を保持する。 */
export interface HistoryEntry {
  /** 履歴エントリの一意識別子 */
  id: string;
  /** 実行日時（ISO 8601） */
  timestamp: string;
  /** 実行ステータス（例: "succeeded", "failed"） */
  status: string;
  /** エラーメッセージ（エラー時のみ） */
  error?: string;
  /** 実行所要時間（秒） */
  elapsed_time?: number;
  /** 使用した合計トークン数 */
  total_tokens?: number;
  /** マークダウン出力が存在するかどうか */
  has_markdown: boolean;
  /** drawio XML 出力が存在するかどうか */
  has_drawio: boolean;
  /** 実行元サービス。"dify"=Dify経由, "gemini"=Gemini経由 */
  source?: string;
}

/** Dify 実行履歴詳細。履歴エントリのメタ情報に加え、出力ファイルの内容を保持する。 */
export interface HistoryDetail {
  /** 履歴エントリの概要情報 */
  entry: HistoryEntry;
  /** 生成されたマークダウンテキスト（存在する場合） */
  markdown?: string;
  /** 生成された drawio XML（存在する場合） */
  drawio?: string;
}
