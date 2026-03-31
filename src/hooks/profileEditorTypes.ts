/**
 * @file プロファイル編集用の型定義とデフォルト値
 * 各サービス（Workato / Dify / Gemini / Workato File API）の
 * Settings 画面で使う編集行の型とデフォルト値を定義する。
 */

/** Workato プロファイルの編集行。API トークンと接続先 URL を管理する */
export interface EditRow {
  name: string;
  description: string;
  api_token: string;
  base_url: string;
  use_proxy: boolean;
}

export const NEW_ROW_DEFAULT: EditRow = {
  name: "",
  description: "",
  api_token: "",
  base_url: "https://app.trial.workato.com",
  use_proxy: false,
};

/** Dify プロファイルの編集行。Dify API のエンドポイントとキーを管理する */
export interface DifyEditRow {
  name: string;
  description: string;
  base_url: string;
  api_key: string;
  user: string;
  production_mode: boolean;
  use_proxy: boolean;
}

export const DIFY_NEW_ROW_DEFAULT: DifyEditRow = {
  name: "",
  description: "",
  base_url: "",
  api_key: "",
  user: "",
  production_mode: false,
  use_proxy: false,
};

/** Gemini プロファイルの編集行。Google Gemini API のキーとモデル名を管理する */
export interface GeminiEditRow {
  name: string;
  description: string;
  api_key: string;
  model: string;
  use_proxy: boolean;
}

export const GEMINI_NEW_ROW_DEFAULT: GeminiEditRow = {
  name: "",
  description: "",
  api_key: "",
  model: "gemini-2.5-flash",
  use_proxy: false,
};

/** Workato File API プロファイルの編集行。ファイル操作用の独立エンドポイントを管理する */
export interface WorkatoFileApiEditRow {
  name: string;
  description: string;
  url: string;
  api_token: string;
  use_proxy: boolean;
}

export const WORKATO_FILE_API_NEW_ROW_DEFAULT: WorkatoFileApiEditRow = {
  name: "",
  description: "",
  url: "",
  api_token: "",
  use_proxy: false,
};

/** Workato API Platform プロファイルの編集行。仕様書生成用のエンドポイントを管理する */
export interface WorkatoApiPlatformEditRow {
  name: string;
  description: string;
  url: string;
  api_token: string;
}

export const WORKATO_API_PLATFORM_NEW_ROW_DEFAULT: WorkatoApiPlatformEditRow = {
  name: "",
  description: "",
  url: "",
  api_token: "",
};
