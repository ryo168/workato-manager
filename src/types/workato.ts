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

// API プロファイル（接続先ごとの認証情報）
export interface Profile {
  name: string;
  api_token: string;
  base_url: string;
  proxy_url?: string;
}

// アプリ設定（プロファイル一覧 + どれがアクティブか）
export interface AppConfig {
  profiles: Profile[];
  active_profile: string;
}
