// Settings 関連の定数

// ---------- エラーメッセージ ----------

export const ERROR = {
  PROFILE_NAME_REQUIRED: "プロファイル名を入力してください。",
  PROFILE_NAME_DUPLICATE: (service: string) => `同じ名前の${service}プロファイルが既に存在します。`,
  PROFILE_LAST_CANNOT_DELETE: "最後のプロファイルは削除できません。",
  PROFILE_AT_LEAST_ONE: "プロファイルが1つ以上必要です。",
} as const;

// ---------- ズーム ----------

export const ZOOM_LEVELS = [75, 80, 85, 90, 95, 100, 110, 120, 130, 150] as const;
export const DEFAULT_ZOOM = "100";
