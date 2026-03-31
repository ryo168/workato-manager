/**
 * @file CSV ファイルの生成・保存ユーティリティ
 * Excel で文字化けしないよう BOM 付き UTF-8 で出力する。
 */

import { invoke } from "@tauri-apps/api/core";

/**
 * セル値を CSV 用にエスケープする。
 * カンマ・ダブルクォート・改行を含む場合はダブルクォートで囲む。
 */
function escapeCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * OS のファイル保存ダイアログを表示し、CSV ファイルとして書き出す。
 * Tauri バックエンドの save_csv_file コマンドを呼び出す。
 */
export async function downloadCsv(
  filename: string,
  headers: string[],
  rows: unknown[][],
): Promise<void> {
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];
  const bom = "\uFEFF";
  const content = bom + lines.join("\r\n");
  await invoke("save_csv_file", { suggestedName: filename, content });
}
