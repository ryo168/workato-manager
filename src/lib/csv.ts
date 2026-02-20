// CSV ファイルの生成・保存。
// Excel で文字化けしないよう BOM 付き UTF-8 で出力する。

import { invoke } from "@tauri-apps/api/core";

// カンマやダブルクォートを含むセルをエスケープする
function escapeCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// 保存ダイアログを出して CSV を書き出す
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
