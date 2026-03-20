// Curl コマンドとレスポンスを表示する API タブコンテンツ。

import { useCallback, useMemo, useState } from "react";
import { Terminal, Braces, Copy } from "lucide-react";

import { copyToClipboard } from "../../lib/clipboard";
import JsonViewer from "../json-viewer";

interface ApiTabContentProps {
  curlCmd: string | null;
  responseText: string | null;
  /** JSON parse 済みデータがあれば JsonViewer で表示（SSE等で生テキストが parse 不能な場合に使用） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsedJson?: any;
}

export default function ApiTabContent({
  curlCmd,
  responseText,
  parsedJson,
}: ApiTabContentProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!curlCmd) return;
    copyToClipboard(curlCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [curlCmd]);

  // レスポンスを JSON parse（parsedJson が渡されていればそちらを優先）
  const parsedResponse = useMemo(() => {
    if (parsedJson !== undefined) return parsedJson;
    if (!responseText) return null;
    try {
      return JSON.parse(responseText);
    } catch {
      return responseText;
    }
  }, [responseText, parsedJson]);

  return (
    <div className="divide-y divide-gray-100">
      {/* Curl コマンド */}
      {curlCmd && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
              <Terminal size={12} />
              Curl コマンド
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-100/60 transition-colors"
            >
              <Copy size={12} />
              {copied ? "コピーしました" : "コピー"}
            </button>
          </div>
          <pre className="rounded-lg bg-gray-900 text-gray-100 px-4 py-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
            {curlCmd}
          </pre>
        </div>
      )}

      {/* レスポンス */}
      {parsedResponse !== null && (
        <div className="p-4">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-500">
            <Braces size={12} />
            レスポンス
          </div>
          {typeof parsedResponse === "string" ? (
            <pre className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[600px] overflow-y-auto">
              {parsedResponse}
            </pre>
          ) : (
            <JsonViewer data={parsedResponse} defaultExpandDepth={2} hideScan showCopy />
          )}
        </div>
      )}

      {/* 空表示 */}
      {!curlCmd && parsedResponse === null && (
        <div className="flex items-center justify-center py-12 text-sm text-gray-400">
          データがありません
        </div>
      )}
    </div>
  );
}
