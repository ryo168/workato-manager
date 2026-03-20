// プロファイル編集で使う共通型・デフォルト値

export interface EditRow {
  name: string;
  api_token: string;
  base_url: string;
  use_proxy: boolean;
}

export const NEW_ROW_DEFAULT: EditRow = {
  name: "",
  api_token: "",
  base_url: "https://app.trial.workato.com",
  use_proxy: false,
};

export interface DifyEditRow {
  name: string;
  base_url: string;
  api_key: string;
  user: string;
  use_proxy: boolean;
}

export const DIFY_NEW_ROW_DEFAULT: DifyEditRow = {
  name: "",
  base_url: "",
  api_key: "",
  user: "",
  use_proxy: false,
};

export interface GeminiEditRow {
  name: string;
  api_key: string;
  model: string;
  use_proxy: boolean;
}

export const GEMINI_NEW_ROW_DEFAULT: GeminiEditRow = {
  name: "",
  api_key: "",
  model: "gemini-2.5-flash",
  use_proxy: false,
};

export interface WorkatoFileApiEditRow {
  name: string;
  url: string;
  api_token: string;
  use_proxy: boolean;
}

export const WORKATO_FILE_API_NEW_ROW_DEFAULT: WorkatoFileApiEditRow = {
  name: "",
  url: "",
  api_token: "",
  use_proxy: false,
};
