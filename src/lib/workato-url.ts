/**
 * @file Workato URL ヘルパー
 * Workato の各エンティティ URL の生成と外部ブラウザでの表示を集約する。
 */

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
