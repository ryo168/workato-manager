// Dify ワークフロー実行ページ。
// JSON をペーストして実行し、結果を表示する。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Workflow,
  Play,
  AlertCircle,
  Download,
  Trash2,
  FolderOpen,
  FileText,
  GitGraph,
  Braces,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Clock,
  Coins,
  Code,
  CheckCircle,
  Settings,
  ChevronDown,
  Hash,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { difyRun, difyLoadResponse, saveMarkdownFile, saveDrawioFile } from "../lib/tauri";
import { useConfig } from "../context/ConfigContext";
import { useDify } from "../context/DifyContext";
import JsonViewer from "../components/json-viewer";
import AlertBanner from "../components/AlertBanner";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";
import { PAGE, HEADER_ROW, CARD, BTN_PRIMARY, BTN_OUTLINED_SM, INPUT_SM } from "../lib/tw";
import type { WorkflowResult } from "../types/workato";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResult(obj: any): WorkflowResult {
  try {
    const data = obj?.data;
    return {
      raw: obj,
      status: data?.status ?? "unknown",
      outputs: data?.outputs ?? null,
      elapsed_time: data?.elapsed_time,
      total_tokens: data?.total_tokens,
      error: data?.error ?? obj?.message,
    };
  } catch {
    return {
      raw: obj,
      status: "parse_error",
      outputs: null,
      error: "レスポンスの解析に失敗しました",
    };
  }
}

/** Dify が改行なしで返すマークダウンを整形する */
function fixMarkdownNewlines(text: string): string {
  if (text.includes("\n")) return text;
  let s = text;
  // 区切り線: " --- " → 独立行に
  s = s.replace(/ ---(?= |$)/g, "\n\n---\n");
  // 見出し: " ## " → 改行して独立行に
  s = s.replace(/ (#{1,6} )/g, "\n\n$1");
  // テーブル行境界: "| |" → 改行
  s = s.replace(/\| \|/g, "|\n|");
  // テーブルヘッダ行の先頭に改行（"|...\n|---" の直前の行頭 | の前）
  s = s.replace(/([^|\n]) (\|[^\n]*\n\|---)/g, "$1\n$2");
  // リスト項目: " - " → 改行
  s = s.replace(/ - /g, "\n- ");
  return s.trim();
}

/** DrawIO XML を data-mxgraph 属性用にエスケープする。
 *  1) JSON 文字列エスケープ（" → \" など）
 *  2) HTML 属性エスケープ（& → &amp; など）
 *  ブラウザが HTML デコード → Draw.io viewer が JSON.parse する順序に対応。
 */
function escapeForDrawioJson(xml: string): string {
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
function buildDrawioHtml(xml: string): string {
  const escaped = escapeForDrawioJson(xml);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;overflow:hidden">
<div class="mxgraph" data-mxgraph='{"highlight":"#0000ff","nav":true,"resize":true,"xml":"${escaped}"}'>
</div>
<script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
</body></html>`;
}

export default function DifyPage() {
  const { config, saveProfiles } = useConfig();
  const {
    jsonInput,
    setJsonInput,
    result,
    setResult,
    error,
    setError,
    running,
    setRunning,
    requestBody,
    setRequestBody,
    responseBody,
    setResponseBody,
  } = useDify();

  const [drawioZoom, setDrawioZoom] = useState(100);
  const [activeTab, setActiveTab] = useState("markdown");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paramOpen, setParamOpen] = useState(false);

  const isDev = localStorage.getItem("developer-mode") === "true";

  const activeDify = config?.dify_profiles?.find(
    (p) => p.name === config.active_dify_profile,
  );
  const difyConfigured = !!(activeDify?.base_url && activeDify?.api_key);

  // --- パラメータ設定のローカル state ---
  const [localFileInput, setLocalFileInput] = useState("");
  const [localMdOutput, setLocalMdOutput] = useState("");
  const [localDrawioOutput, setLocalDrawioOutput] = useState("");
  const [localDocTypeProp, setLocalDocTypeProp] = useState("");
  const [localDocType, setLocalDocType] = useState(1);
  const [paramSaved, setParamSaved] = useState(false);
  const paramInitialized = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;
  const activeDifyRef = useRef(activeDify);
  activeDifyRef.current = activeDify;
  const saveProfilesRef = useRef(saveProfiles);
  saveProfilesRef.current = saveProfiles;

  // アクティブプロファイル変更時にローカル state を同期
  useEffect(() => {
    if (activeDify) {
      paramInitialized.current = false;
      setLocalFileInput(activeDify.file_input_name ?? "");
      setLocalMdOutput(activeDify.markdown_output_name ?? "");
      setLocalDrawioOutput(activeDify.drawio_output_name ?? "");
      setLocalDocTypeProp(activeDify.doc_type_property_name ?? "");
      setLocalDocType(activeDify.doc_type ?? 1);
      requestAnimationFrame(() => { paramInitialized.current = true; });
    }
  }, [activeDify?.name]);

  // デバウンス自動保存（500ms） — ローカル state の変更時のみ発火
  useEffect(() => {
    if (!paramInitialized.current) return;
    const timer = setTimeout(async () => {
      const cfg = configRef.current;
      const active = activeDifyRef.current;
      if (!cfg || !active) return;
      const updatedDifyProfiles = cfg.dify_profiles.map((p) =>
        p.name === active.name
          ? {
              ...p,
              file_input_name: localFileInput.trim() || undefined,
              markdown_output_name: localMdOutput.trim() || undefined,
              drawio_output_name: localDrawioOutput.trim() || undefined,
              doc_type_property_name: localDocTypeProp.trim() || undefined,
              doc_type: localDocType,
            }
          : p,
      );
      try {
        await saveProfilesRef.current(
          cfg.profiles,
          cfg.active_profile,
          updatedDifyProfiles,
          cfg.active_dify_profile,
          cfg.proxy_url,
        );
        setParamSaved(true);
        setTimeout(() => setParamSaved(false), 2000);
      } catch {
        // ignore
      }
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localFileInput, localMdOutput, localDrawioOutput, localDocTypeProp, localDocType]);

  // outputs からマークダウン / DrawIO テキストを抽出（ローカル state を使用）
  const mdOutputKey = localMdOutput.trim() || "text";
  const drawioOutputKey = localDrawioOutput.trim() || "drawio_xml";

  const markdownText = useMemo(() => {
    if (!result?.outputs) return null;
    const outputs = result.outputs as Record<string, unknown>;
    const val = outputs[mdOutputKey];
    if (typeof val === "string" && val.trim()) {
      return fixMarkdownNewlines(val);
    }
    return null;
  }, [result, mdOutputKey]);

  const drawioXml = useMemo(() => {
    if (!result?.outputs) return null;
    const outputs = result.outputs as Record<string, unknown>;
    const val = outputs[drawioOutputKey];
    return typeof val === "string" && val.trim() ? val : null;
  }, [result, drawioOutputKey]);

  const drawioHtml = useMemo(
    () => (drawioXml ? buildDrawioHtml(drawioXml) : null),
    [drawioXml],
  );

  // タブ定義（利用可能なものだけ動的に構築）
  const tabs = useMemo(() => {
    const t: { id: string; label: string; icon: React.ReactNode }[] = [];
    if (markdownText) t.push({ id: "markdown", label: "マークダウン", icon: <FileText size={14} /> });
    if (drawioHtml) t.push({ id: "drawio", label: "draw.io", icon: <GitGraph size={14} /> });
    if (isDev) t.push({ id: "response", label: "レスポンス", icon: <Braces size={14} /> });
    if (isDev && requestBody) t.push({ id: "request-raw", label: "リクエスト全文", icon: <Code size={14} /> });
    if (isDev && responseBody) t.push({ id: "response-raw", label: "レスポンス全文", icon: <Code size={14} /> });
    return t;
  }, [markdownText, drawioHtml, isDev, requestBody, responseBody]);

  // アクティブタブが無効になったら最初のタブを選択
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  const handleRunClick = useCallback(() => {
    if (!jsonInput.trim()) return;

    // JSON として有効か検証
    try {
      JSON.parse(jsonInput);
    } catch {
      setError("入力された JSON が不正です。正しい JSON を入力してください。");
      return;
    }

    setConfirmOpen(true);
  }, [jsonInput, setError]);

  const handleRunConfirm = useCallback(async () => {
    setConfirmOpen(false);
    setRunning(true);
    setResult(null);
    setError(null);
    setRequestBody(null);
    setResponseBody(null);

    try {
      const response = await difyRun(jsonInput);
      const parsed = JSON.parse(response.result_json);
      setResult(parseResult(parsed));
      setRequestBody(response.request_body);
      setResponseBody(response.response_body);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }, [jsonInput, setRunning, setResult, setError, setRequestBody, setResponseBody]);

  const handleClear = useCallback(() => {
    setJsonInput("");
    setResult(null);
    setError(null);
    setRequestBody(null);
    setResponseBody(null);
  }, [setJsonInput, setResult, setError, setRequestBody, setResponseBody]);

  const handleLoadFile = useCallback(async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    setRequestBody(null);
    setResponseBody(null);

    try {
      const response = await difyLoadResponse();
      const parsed = JSON.parse(response.result_json);
      setResult(parseResult(parsed));
      setRequestBody(response.request_body);
      setResponseBody(response.response_body);
    } catch (e) {
      const msg = String(e);
      if (!msg.includes("ファイルが選択されませんでした")) {
        setError(msg);
      }
    } finally {
      setRunning(false);
    }
  }, [setRunning, setResult, setError, setRequestBody, setResponseBody]);

  return (
    <div className={PAGE}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-500">
            <Workflow size={20} />
          </span>
          <h1 className="text-xl font-bold text-gray-600">Dify</h1>
        </div>
        <button
          onClick={handleClear}
          disabled={running}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 disabled:opacity-40"
        >
          <Trash2 size={16} />
          クリア
        </button>
      </div>

      {/* Dify 未設定の場合の案内 */}
      {!difyConfigured && (
        <AlertBanner severity="warning" className="mb-5">
          Dify API の設定がされていません。Settings ページで API URL と API キーを設定してください。
        </AlertBanner>
      )}

      {/* パラメータ設定 */}
      {activeDify && (
        <div className={`${CARD} mb-5 overflow-hidden`}>
          {/* ヘッダー（常時表示・クリックで開閉） */}
          <button
            onClick={() => setParamOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 hover:bg-gray-50/60 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                <Settings size={14} />
              </span>
              <span className="text-sm font-semibold text-gray-700">パラメータ設定</span>
              {paramSaved && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-500 animate-fade-in">
                  <CheckCircle size={11} />
                  保存しました
                </span>
              )}
            </div>
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform duration-200 ${paramOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* 折りたたみコンテンツ */}
          <div
            className={`grid transition-all duration-200 ease-in-out ${
              paramOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {/* 入力カード */}
                  <div className="rounded-lg border border-amber-200/60 bg-amber-50/40 p-3">
                    <div className="mb-2.5 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-100 text-amber-600">
                        <Code size={11} />
                      </span>
                      <span className="text-xs font-semibold text-amber-700">入力</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-500">
                          <Braces size={10} className="text-amber-500" />
                          jsonProperty
                        </label>
                        <input
                          type="text"
                          className={INPUT_SM}
                          value={localFileInput}
                          onChange={(e) => setLocalFileInput(e.target.value)}
                          placeholder="file"
                        />
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-500">
                          <Hash size={10} className="text-amber-500" />
                          docTypeProperty
                        </label>
                        <input
                          type="text"
                          className={INPUT_SM}
                          value={localDocTypeProp}
                          onChange={(e) => setLocalDocTypeProp(e.target.value)}
                          placeholder="doc_type"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 出力カード */}
                  <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-3">
                    <div className="mb-2.5 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-600">
                        <Code size={11} />
                      </span>
                      <span className="text-xs font-semibold text-emerald-700">出力</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-500">
                          <FileText size={10} className="text-emerald-500" />
                          mdProperty
                        </label>
                        <input
                          type="text"
                          className={INPUT_SM}
                          value={localMdOutput}
                          onChange={(e) => setLocalMdOutput(e.target.value)}
                          placeholder="text"
                        />
                      </div>
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-500">
                          <GitGraph size={10} className="text-emerald-500" />
                          draw.ioProperty
                        </label>
                        <input
                          type="text"
                          className={INPUT_SM}
                          value={localDrawioOutput}
                          onChange={(e) => setLocalDrawioOutput(e.target.value)}
                          placeholder="drawio_xml"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 複数フローモード */}
                <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-200/80 bg-gray-50/50 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-medium text-gray-700">複数フローモード</span>
                    <span className="text-[11px] text-gray-400">
                      ONにするとdocTypePropertyの値が2になります
                    </span>
                  </div>
                  <button
                    onClick={() => setLocalDocType(localDocType === 2 ? 1 : 2)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300/40 focus:ring-offset-1 ${
                      localDocType === 2 ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                        localDocType === 2 ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JSON 入力エリア */}
      <div className={`${CARD} mb-5`}>
        <div className="border-b border-gray-200 bg-blue-50 px-4 py-3 rounded-t-lg">
          <span className="text-sm font-semibold text-blue-700">
            JSON 入力
          </span>
        </div>
        <div className="p-4">
          <textarea
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300/30 disabled:opacity-50"
            rows={12}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="ここに JSON をペーストしてください..."
            disabled={running}
          />
        </div>
        <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-3">
          <button
            className={BTN_PRIMARY}
            disabled={!jsonInput.trim() || running || !difyConfigured}
            onClick={handleRunClick}
          >
            {running ? (
              <Spinner size={16} />
            ) : (
              <Play size={16} />
            )}
            {running ? "実行中" : "実行"}
          </button>
          {isDev && (
            <button
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-40"
              disabled={running}
              onClick={handleLoadFile}
            >
              <FolderOpen size={16} />
              ファイル読込
            </button>
          )}
          {running && (
            <span className="text-xs text-gray-400">
              Dify ワークフローを実行しています...
            </span>
          )}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <AlertBanner severity="error" className="mb-5">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </AlertBanner>
      )}

      {/* 実行中アニメーション */}
      {running && (
        <div className={`${CARD} mb-5`}>
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner size={48} />
            <p className="mt-4 text-sm text-gray-500 animate-pulse">
              Dify ワークフローを実行しています...
            </p>
          </div>
        </div>
      )}

      {/* 結果表示 — タブ切り替え */}
      {result && (
        <div className={`${CARD} mb-5`}>
          {/* ヘッダー: ステータス & メタ情報 */}
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 rounded-t-lg border-b border-blue-100">
            <span className="text-sm font-semibold text-blue-700">
              実行結果
            </span>
            <div className="flex items-center gap-3">
              {(result.elapsed_time != null || result.total_tokens != null) && (
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
            </div>
          </div>

          {result.status === "failed" && result.error && (
            <div className="border-b border-gray-100 px-4 py-3">
              <AlertBanner severity="error">{result.error}</AlertBanner>
            </div>
          )}

          {/* タブバー */}
          <div className="flex border-b border-gray-200 bg-gray-50/50 px-2 gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* タブコンテンツ */}
          {/* マークダウン */}
          {activeTab === "markdown" && markdownText && (
            <div>
              <div className="flex items-center justify-end px-4 pt-3">
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {markdownText}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* draw.io */}
          {activeTab === "drawio" && drawioHtml && drawioXml && (
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

          {/* レスポンス (JSON) */}
          {activeTab === "response" && (
            <div className="p-4">
              <JsonViewer data={result.raw} defaultExpandDepth={2} hideScan showCopy />
            </div>
          )}

          {/* リクエスト全文 (Developer) */}
          {activeTab === "request-raw" && requestBody && (
            <pre className="px-4 py-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[600px] overflow-y-auto">
              {requestBody}
            </pre>
          )}

          {/* レスポンス全文 (Developer) */}
          {activeTab === "response-raw" && responseBody && (
            <pre className="px-4 py-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-[600px] overflow-y-auto">
              {responseBody}
            </pre>
          )}
        </div>
      )}
      {/* 実行確認モーダル */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="実行確認"
        maxWidth="max-w-sm"
        footer={
          <>
            <button className={BTN_OUTLINED_SM} onClick={() => setConfirmOpen(false)}>
              キャンセル
            </button>
            <button className={BTN_PRIMARY} onClick={handleRunConfirm}>
              <Play size={16} />
              実行
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Dify ワークフローを実行しますか？
        </p>
      </Modal>
    </div>
  );
}
