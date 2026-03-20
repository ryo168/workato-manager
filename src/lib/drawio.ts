// DrawIO XML のエスケープと HTML 生成ユーティリティ。

/** DrawIO XML を data-mxgraph 属性用にエスケープする。
 *  1) JSON 文字列エスケープ（" → \" など）
 *  2) HTML 属性エスケープ（& → &amp; など）
 *  ブラウザが HTML デコード → Draw.io viewer が JSON.parse する順序に対応。
 */
export function escapeForDrawioJson(xml: string): string {
  // Step 1: JSON string escaping
  let s = xml
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  // Step 2: HTML attribute escaping
  s = s
    .replace(/&/g, "&amp;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return s;
}

/** draw.io viewer 用の srcdoc HTML を生成 */
export function buildDrawioHtml(xml: string): string {
  const escaped = escapeForDrawioJson(xml);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;overflow:hidden">
<div class="mxgraph" data-mxgraph='{"highlight":"#0000ff","nav":true,"resize":true,"xml":"${escaped}"}'>
</div>
<script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
</body></html>`;
}
