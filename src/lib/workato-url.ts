// Workato URL ヘルパー。外部ブラウザで開く操作を集約。

import { openUrl } from "@tauri-apps/plugin-opener";

/** base_url の末尾スラッシュ除去 */
export function normalizeBaseUrl(baseUrl: string | undefined): string {
  return (baseUrl ?? "").replace(/\/+$/, "");
}

/** Workato URL を外部ブラウザで開く */
export function openWorkatoUrl(baseUrl: string, path: string): void {
  if (baseUrl) openUrl(`${baseUrl}${path}`);
}

/** エンティティ別パス生成 */
export const workatoUrls = {
  recipe: (id: number) => `/recipes/${id}`,
  connection: (id: number) => `/connections/${id}`,
  folder: (folderId: number) => `/recipes?fid=${folderId}`,
} as const;
