// 実行結果カード。ステータス表示・タブ切り替え・各タブコンテンツを含む。

import React from "react";
import {
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Clock,
  Coins,
  FileEdit,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import { saveMarkdownFile, saveDrawioFile } from "../../lib/tauri";
import { CARD } from "../../lib/tw";
import AlertBanner from "../AlertBanner";
import ApiTabContent from "./ApiTabContent";

import type { WorkflowResult } from "../../types/workato";

interface TabDef {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface DifyResultSectionProps {
  hasResult: unknown;
  result: WorkflowResult | null;
  error: string | null;
  tabs: TabDef[];
  effectiveTab: string;
  setActiveTab: (v: string) => void;
  markdownText: string | null;
  drawioHtml: string | null;
  drawioXml: string | null;
  drawioZoom: number;
  setDrawioZoom: React.Dispatch<React.SetStateAction<number>>;
  fileUploadCurl: string | null;
  fileUploadResponse: string | null;
  workflowCurl: string | null;
  workflowResponse: string | null;
  onOpenEditor: () => void;
}

export default function DifyResultSection({
  hasResult,
  result,
  error: _error, // eslint-disable-line @typescript-eslint/no-unused-vars
  tabs,
  effectiveTab,
  setActiveTab,
  markdownText,
  drawioHtml,
  drawioXml,
  drawioZoom,
  setDrawioZoom,
  fileUploadCurl,
  fileUploadResponse,
  workflowCurl,
  workflowResponse,
  onOpenEditor,
}: DifyResultSectionProps) {
  if (!hasResult) return null;

  return (
    <div className={`${CARD} mb-5`}>
      {/* ヘッダー: ステータス & メタ情報 */}
      <div className="flex items-center justify-between bg-gray-100 px-4 py-3 rounded-t-lg border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-400 text-[10px] font-bold text-gray-500">3</span>
          <span className="text-sm font-semibold text-gray-700">実行結果</span>
        </div>
        <div className="flex items-center gap-3">
          {result && (result.elapsed_time != null || result.total_tokens != null) && (
            <div className="flex gap-4 text-xs text-gray-500">
              {result.elapsed_time != null && (
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-gray-400" />
                  {result.elapsed_time.toFixed(2)}s
                </span>
              )}
              {result.total_tokens != null && (
                <span className="flex items-center gap-1">
                  <Coins size={12} className="text-gray-400" />
                  {result.total_tokens.toLocaleString()}
                </span>
              )}
            </div>
          )}
          {result && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                result.status === "succeeded"
                  ? "bg-green-100 text-green-700"
                  : result.status === "failed"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {result.status}
            </span>
          )}
        </div>
      </div>

      {result && result.status === "failed" && result.error && (
        <div className="border-b border-gray-100 px-4 py-3">
          <AlertBanner severity="error">{result.error}</AlertBanner>
        </div>
      )}

      {/* タブバー */}
      {tabs.length > 0 && (
        <div className="flex border-b border-gray-200 bg-gray-50/50 px-2 gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                effectiveTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* タブコンテンツ */}
      {/* マークダウン */}
      {effectiveTab === "markdown" && markdownText && (
        <div>
          <div className="flex items-center justify-end gap-2 px-4 pt-3">
            <button
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-teal-600 hover:bg-teal-100/60"
              onClick={onOpenEditor}
              title="マークダウンエディタで編集"
            >
              <FileEdit size={14} />
              編集
            </button>
            <button
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-100/60"
              onClick={() => saveMarkdownFile("output.md", markdownText)}
              title="Markdownファイルとして保存"
            >
              <Download size={14} />
              保存
            </button>
          </div>
          <div className="prose prose-sm max-w-none px-5 py-4 text-gray-700 prose-headings:text-gray-800 prose-h1:text-xl prose-h1:mb-3 prose-h1:mt-5 prose-h1:pb-1 prose-h1:border-b prose-h1:border-gray-200 prose-h2:text-lg prose-h2:mb-2 prose-h2:mt-4 prose-h3:text-base prose-h3:mb-2 prose-h3:mt-3 prose-h4:text-sm prose-h4:mt-3 prose-p:mb-2 prose-p:leading-relaxed prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-2 prose-ol:list-decimal prose-ol:pl-5 prose-ol:mb-2 prose-li:mb-0.5 prose-table:border-collapse prose-table:w-full prose-table:mb-3 prose-th:border prose-th:border-gray-300 prose-th:bg-gray-50 prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-td:border prose-td:border-gray-300 prose-td:px-3 prose-td:py-1.5 prose-td:text-sm prose-hr:my-4 prose-hr:border-gray-300 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:mb-3 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600 prose-blockquote:mb-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {markdownText}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* draw.io */}
      {effectiveTab === "drawio" && drawioHtml && drawioXml && (
        <div>
          <div className="flex items-center justify-between px-4 pt-3">
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-1">
              <button
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                onClick={() => setDrawioZoom((z) => Math.max(20, z - 10))}
                title="縮小"
              >
                <ZoomOut size={14} />
              </button>
              <span className="min-w-[3rem] text-center text-xs font-medium text-gray-600">
                {drawioZoom}%
              </span>
              <button
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                onClick={() => setDrawioZoom((z) => Math.min(300, z + 10))}
                title="拡大"
              >
                <ZoomIn size={14} />
              </button>
              <button
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                onClick={() => setDrawioZoom(100)}
                title="リセット"
              >
                <Maximize2 size={14} />
              </button>
            </div>
            <button
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-100/60"
              onClick={() => saveDrawioFile("output.drawio", drawioXml)}
              title="Draw.ioファイルとして保存"
            >
              <Download size={14} />
              保存
            </button>
          </div>
          <div className="overflow-auto px-4 py-4" style={{ maxHeight: 600 }}>
            <div style={{ zoom: drawioZoom / 100 }}>
              <iframe
                srcDoc={drawioHtml}
                referrerPolicy="no-referrer"
                className="w-full rounded border border-gray-200"
                style={{ height: 1500, pointerEvents: "none" }}
                title="draw.io Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* ファイルAPI */}
      {effectiveTab === "file-api" && (
        <ApiTabContent
          curlCmd={fileUploadCurl}
          responseText={fileUploadResponse}
        />
      )}

      {/* ワークフローAPI */}
      {effectiveTab === "workflow-api" && (
        <ApiTabContent
          curlCmd={workflowCurl}
          responseText={workflowResponse}
          parsedJson={result?.raw}
        />
      )}
    </div>
  );
}
