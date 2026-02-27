// Workato API のレスポンス型。Rust 側が返す JSON に対応してる。

// レシピ内のコネクション設定エントリ
export interface RecipeConfigEntry {
  keyword?: string;
  name?: string;
  provider?: string;
  account_id?: number | string | null; // 文字列・数値どっちも来る
}

// レシピ
export interface Recipe {
  id: number;
  name: string;
  running: boolean | null; // null = 状態不明
  description?: string;
  last_run_at?: string;
  created_at?: string;
  updated_at?: string;
  stopped_at?: string;
  job_succeeded_count?: number;
  job_failed_count?: number;
  folder_id?: number;
  project_id?: number;
  trigger_application?: string;
  config: RecipeConfigEntry[];
  code?: Record<string, unknown>;
}

// ジョブ（レシピの実行履歴 1 件）
export interface Job {
  id: string;
  title?: string;
  is_error?: boolean;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

// コネクション
export interface Connection {
  id: number;
  name: string;
  application?: string;
  authorization_status?: string; // "success" = 認証OK
  authorized_at?: string;
  created_at?: string;
  updated_at?: string;
  folder_id?: number;
  project_id?: number;
}

// フォルダ
export interface Folder {
  id: number;
  name: string;
  parent_id?: number;
  created_at?: string;
  updated_at?: string;
}

// プロジェクト
export interface Project {
  id: number;
  name: string;
  description?: string;
  folder_id: number;
}

// Workato API プロファイル（接続先ごとの認証情報）
export interface Profile {
  name: string;
  api_token: string;
  base_url: string;
}

// Dify API プロファイル
export interface DifyProfile {
  name: string;
  base_url: string;
  api_key: string;
  user?: string;
  file_input_name?: string;
  markdown_output_name?: string;
  drawio_output_name?: string;
  doc_type_property_name?: string;
  doc_type?: number;
}

// アプリ設定（プロファイル一覧 + どれがアクティブか + 共通プロキシ）
export interface AppConfig {
  profiles: Profile[];
  active_profile: string;
  dify_profiles: DifyProfile[];
  active_dify_profile: string;
  proxy_url?: string;
}

// Dify ワークフロー実行結果（Rust DifyRunResult に対応）
export interface DifyRunResult {
  result_json: string;
  request_body: string;
  response_body: string;
}

// Dify ワークフロー結果のパース後構造
export interface WorkflowResult {
  raw: unknown;
  status: string;
  outputs: unknown;
  elapsed_time?: number;
  total_tokens?: number;
  error?: string;
}
