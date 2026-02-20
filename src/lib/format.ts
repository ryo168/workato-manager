// 日付・トークンのフォーマットユーティリティ。

/** 日付文字列を "ja-JP" ロケールで表示用に変換 */
export function formatDateJP(
  dateStr: string | null | undefined,
  fallback = "-",
): string {
  if (!dateStr) return fallback;
  return new Date(dateStr).toLocaleString("ja-JP");
}

/** ISO日付 YYYY-MM-DD を返す（ファイル名用） */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** トークンを末尾4文字以外マスク */
export function maskToken(token: string): string {
  if (!token) return "（未設定）";
  if (token.length <= 4) return "****";
  return `****${token.slice(-4)}`;
}
