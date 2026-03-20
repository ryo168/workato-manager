// クリップボード操作のユーティリティ。

/** テキストをクリップボードにコピー */
export function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    // fallback: ignore
  });
}
