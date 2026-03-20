// Dify ワークフロー実行ページ。
// JSON をペーストして実行し、結果を表示する。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  CheckCircle,
  Upload,
  Copy,
  Terminal,
  FileEdit,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { difyRun, difyUploadOnly, difyLoadResponse, saveMarkdownFile, saveDrawioFile, saveHistoryEntry } from "../lib/tauri";
import { useConfig } from "../context/ConfigContext";
import { useDify } from "../context/DifyContext";
import { useGemini } from "../context/GeminiContext";
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

/** テキストをクリップボードにコピー */
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    // fallback: ignore
  });
}

/** Curl + Response セクション */
function ApiTabContent({
  curlCmd,
  responseText,
  parsedJson,
}: {
  curlCmd: string | null;
  responseText: string | null;
  /** JSON parse 済みデータがあれば JsonViewer で表示（SSE等で生テキストが parse 不能な場合に使用） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsedJson?: any;
}) {
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

export default function DifyPage() {
  const navigate = useNavigate();
  const { setPendingMarkdown } = useGemini();
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
    fileUploadRequest: _fileUploadRequest,
    setFileUploadRequest,
    fileUploadResponse,
    setFileUploadResponse,
    fileUploadCurl,
    setFileUploadCurl,
    workflowRequest: _workflowRequest,
    setWorkflowRequest,
    workflowResponse,
    setWorkflowResponse,
    workflowCurl,
    setWorkflowCurl,
    diagnosticLog: _diagnosticLog,
    setDiagnosticLog,
  } = useDify();

  const [drawioZoom, setDrawioZoom] = useState(100);
  const [activeTab, setActiveTab] = useState("markdown");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // 実行中の経過秒数タイマー
  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => clearInterval(id);
  }, [running]);

  const isDev = localStorage.getItem("developer-mode") === "true";

  const activeDify = config?.dify_profiles?.find(
    (p) => p.name === config.active_dify_profile,
  );
  const difyConfigured = !!(activeDify?.base_url && activeDify?.api_key);

  // --- パラメータ設定のローカル state ---
  const [localFileInput, setLocalFileInput] = useState("");
  const [localMdOutput, setLocalMdOutput] = useState("");
  const [localDrawioOutput, setLocalDrawioOutput] = useState("");
  const [localParam1Name, setLocalParam1Name] = useState("");
  const [localParam1Value, setLocalParam1Value] = useState("");
  const [localParam2Name, setLocalParam2Name] = useState("");
  const [localParam2Value, setLocalParam2Value] = useState("");
  const [localParam3Name, setLocalParam3Name] = useState("");
  const [localParam3Value, setLocalParam3Value] = useState("");
  const [localParam4Name, setLocalParam4Name] = useState("");
  const [localParam4Value, setLocalParam4Value] = useState("");
  const [localWorkatoFileIdParam, setLocalWorkatoFileIdParam] = useState("");
  const [localFileApiMode, setLocalFileApiMode] = useState("dify");
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
      setLocalParam1Name(activeDify.param1_name ?? "");
      setLocalParam1Value(activeDify.param1_value ?? "");
      setLocalParam2Name(activeDify.param2_name ?? "");
      setLocalParam2Value(activeDify.param2_value ?? "");
      setLocalParam3Name(activeDify.param3_name ?? "");
      setLocalParam3Value(activeDify.param3_value ?? "");
      setLocalParam4Name(activeDify.param4_name ?? "");
      setLocalParam4Value(activeDify.param4_value ?? "");
      setLocalWorkatoFileIdParam(activeDify.workato_file_id_param ?? "");
      setLocalFileApiMode(activeDify.file_api_mode ?? "dify");
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
              workato_file_id_param: localWorkatoFileIdParam.trim() || undefined,
              param1_name: localParam1Name.trim() || undefined,
              param1_value: localParam1Value.trim() || undefined,
              param2_name: localParam2Name.trim() || undefined,
              param2_value: localParam2Value.trim() || undefined,
              param3_name: localParam3Name.trim() || undefined,
              param3_value: localParam3Value.trim() || undefined,
              param4_name: localParam4Name.trim() || undefined,
              param4_value: localParam4Value.trim() || undefined,
              file_api_mode: localFileApiMode || undefined,
            }
          : p,
      );
      try {
        await saveProfilesRef.current(
          cfg.profiles,
          cfg.active_profile,
          updatedDifyProfiles,
          cfg.active_dify_profile,
          cfg.gemini_profiles ?? [],
          cfg.active_gemini_profile ?? "",
          cfg.workato_file_api_profiles ?? [],
          cfg.active_workato_file_api_profile ?? "",
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
  }, [localFileInput, localMdOutput, localDrawioOutput, localWorkatoFileIdParam, localParam1Name, localParam1Value, localParam2Name, localParam2Value, localParam3Name, localParam3Value, localParam4Name, localParam4Value, localFileApiMode]);

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

  // タブ定義（マークダウン・draw.io は結果がある場合のみ、API タブは常に表示）
  const tabs = useMemo(() => {
    const t: { id: string; label: string; icon: React.ReactNode }[] = [];
    if (markdownText) t.push({ id: "markdown", label: "マークダウン", icon: <FileText size={14} /> });
    if (drawioHtml) t.push({ id: "drawio", label: "draw.io", icon: <GitGraph size={14} /> });
    t.push({ id: "file-api", label: "ファイルAPI", icon: <Upload size={14} /> });
    t.push({ id: "workflow-api", label: "ワークフローAPI", icon: <Terminal size={14} /> });
    return t;
  }, [markdownText, drawioHtml]);

  // activeTab が現在の tabs に存在しない場合のフォールバック（計算値で解決、useEffect の race condition を回避）
  const effectiveTab = tabs.find((t) => t.id === activeTab)
    ? activeTab
    : tabs.find((t) => t.id === "markdown")
      ? "markdown"
      : (tabs[0]?.id ?? "markdown");

  /** 全state をクリアするヘルパー */
  const clearAll = useCallback(() => {
    setFileUploadRequest(null);
    setFileUploadResponse(null);
    setFileUploadCurl(null);
    setWorkflowRequest(null);
    setWorkflowResponse(null);
    setWorkflowCurl(null);
    setDiagnosticLog(null);
  }, [setFileUploadRequest, setFileUploadResponse, setFileUploadCurl, setWorkflowRequest, setWorkflowResponse, setWorkflowCurl, setDiagnosticLog]);

  /** レスポンスから state をセットするヘルパー */
  const applyResponse = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (response: any) => {
      setFileUploadRequest(response.file_upload_request || null);
      setFileUploadResponse(response.file_upload_response || null);
      setFileUploadCurl(response.file_upload_curl || null);
      setWorkflowRequest(response.workflow_request || null);
      setWorkflowResponse(response.workflow_response || null);
      setWorkflowCurl(response.workflow_curl || null);
      setDiagnosticLog(response.diagnostic_log || null);
    },
    [setFileUploadRequest, setFileUploadResponse, setFileUploadCurl, setWorkflowRequest, setWorkflowResponse, setWorkflowCurl, setDiagnosticLog],
  );

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
    setActiveTab("markdown");
    clearAll();

    let parsedResult: WorkflowResult | null = null;
    let runError: string | null = null;

    try {
      const response = await difyRun(jsonInput);
      applyResponse(response);

      if (response.result_json) {
        const parsed = JSON.parse(response.result_json);
        parsedResult = parseResult(parsed);
        setResult(parsedResult);
      }

      // Rust 側で error フィールドが返ってきた場合（partial success）
      if (response.error) {
        runError = response.error;
        setError(response.error);
      }
    } catch (e) {
      runError = String(e);
      setError(runError);
    } finally {
      setRunning(false);

      // 履歴保存（fire-and-forget）
      const outputs = parsedResult?.outputs as Record<string, unknown> | null;
      const mdKey = localMdOutput.trim() || "text";
      const dxKey = localDrawioOutput.trim() || "drawio_xml";
      const md = typeof outputs?.[mdKey] === "string" ? (outputs[mdKey] as string) : undefined;
      const dx = typeof outputs?.[dxKey] === "string" ? (outputs[dxKey] as string) : undefined;

      saveHistoryEntry({
        status: parsedResult?.status ?? (runError ? "failed" : "unknown"),
        error: parsedResult?.error ?? runError,
        elapsed_time: parsedResult?.elapsed_time,
        total_tokens: parsedResult?.total_tokens,
        markdown: md,
        drawio: dx,
      }).catch(() => {/* 履歴保存失敗は無視 */});
    }
  }, [jsonInput, setRunning, setResult, setError, clearAll, applyResponse, localMdOutput, localDrawioOutput]);

  const handleClear = useCallback(() => {
    setJsonInput("");
    setResult(null);
    setError(null);
    clearAll();
  }, [setJsonInput, setResult, setError, clearAll]);

  const handleLoadFile = useCallback(async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    clearAll();

    try {
      const response = await difyLoadResponse();
      applyResponse(response);

      if (response.result_json) {
        const parsed = JSON.parse(response.result_json);
        setResult(parseResult(parsed));
      }
    } catch (e) {
      const msg = String(e);
      if (!msg.includes("ファイルが選択されませんでした")) {
        setError(msg);
      }
    } finally {
      setRunning(false);
    }
  }, [setRunning, setResult, setError, clearAll, applyResponse]);

  // 実行結果があるかどうか（エラー時も部分データがあれば表示）
  const hasResult = result || error || fileUploadCurl || fileUploadResponse || workflowCurl || workflowResponse;

  return (
    <div className={PAGE}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25">
            <Workflow size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-600">Dify</h1>
            <p className="text-xs text-gray-400 mt-0.5">JSON を入力してワークフローを実行</p>
          </div>
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
        <>
          {/* ファイルAPI設定 + JSON入力 */}
          <div className={`${CARD} mb-5 overflow-hidden`}>
            <div className="flex items-center gap-2.5 bg-gray-100 px-4 py-3 rounded-t-lg border-b border-gray-200">
              <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-400 text-[10px] font-bold text-gray-500">1</span>
              <span className="text-sm font-semibold text-gray-700">ファイルAPI設定</span>
              {paramSaved && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-500 animate-fade-in">
                  <CheckCircle size={11} />
                  保存しました
                </span>
              )}
            </div>
            <div className="px-4 pb-4 pt-3">
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                {localFileApiMode === "workato" ? (
                  <div>
                    <label className="mb-1 text-[11px] font-medium text-gray-500">ファイルIDの入力変数名</label>
                    <input type="text" className={INPUT_SM} value={localWorkatoFileIdParam} onChange={(e) => setLocalWorkatoFileIdParam(e.target.value)} placeholder="workato_file_id" />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 text-[11px] font-medium text-gray-500">Json情報の入力変数</label>
                    <input type="text" className={INPUT_SM} value={localFileInput} onChange={(e) => setLocalFileInput(e.target.value)} placeholder="file" />
                  </div>
                )}
              </div>

              {/* Workato File API トグル */}
              <div className="rounded-lg border border-gray-200/80 bg-gray-50/50 px-3 py-2.5 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Workato File API</span>
                  <button
                    onClick={() => setLocalFileApiMode(localFileApiMode === "workato" ? "dify" : "workato")}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300/40 focus:ring-offset-1 ${
                      localFileApiMode === "workato" ? "bg-purple-500" : "bg-gray-300"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${localFileApiMode === "workato" ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-gray-400">
                  {localFileApiMode === "workato"
                    ? "ON: Workato File API を使用してファイルをアップロードします。"
                    : "OFF: Dify File API を使用してファイルをアップロードします。"}
                </p>
              </div>

              {/* JSON 入力 */}
              <textarea
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300/30 disabled:opacity-50"
                rows={12}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="ここに JSON をペーストしてください..."
                disabled={running}
              />
            </div>
          </div>

          {/* ワークフロー設定 */}
          <div className={`${CARD} mb-5 overflow-hidden`}>
            <div className="flex items-center gap-2.5 bg-gray-100 px-4 py-3 rounded-t-lg border-b border-gray-200">
              <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-400 text-[10px] font-bold text-gray-500">2</span>
              <span className="text-sm font-semibold text-gray-700">ワークフロー設定</span>
            </div>
            <div className="px-4 pb-4 pt-3">
              {/* 入力変数（カスタムパラメータ 1-4） */}
              <div className="rounded-lg border border-gray-200/80 bg-gray-50/50 px-3 py-2.5 mb-3">
                <span className="text-[11px] font-semibold text-gray-500 mb-2 block">入力変数</span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 text-[11px] font-medium text-gray-400">カスタム入力変数 1</label>
                    <div className="flex items-center gap-1.5">
                      <input type="text" className={INPUT_SM} value={localParam1Name} onChange={(e) => setLocalParam1Name(e.target.value)} placeholder="変数名" />
                      <span className="text-gray-300">=</span>
                      <input type="text" className={INPUT_SM} value={localParam1Value} onChange={(e) => setLocalParam1Value(e.target.value)} placeholder="値" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 text-[11px] font-medium text-gray-400">カスタム入力変数 2</label>
                    <div className="flex items-center gap-1.5">
                      <input type="text" className={INPUT_SM} value={localParam2Name} onChange={(e) => setLocalParam2Name(e.target.value)} placeholder="変数名" />
                      <span className="text-gray-300">=</span>
                      <input type="text" className={INPUT_SM} value={localParam2Value} onChange={(e) => setLocalParam2Value(e.target.value)} placeholder="値" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 text-[11px] font-medium text-gray-400">カスタム入力変数 3</label>
                    <div className="flex items-center gap-1.5">
                      <input type="text" className={INPUT_SM} value={localParam3Name} onChange={(e) => setLocalParam3Name(e.target.value)} placeholder="変数名" />
                      <span className="text-gray-300">=</span>
                      <input type="text" className={INPUT_SM} value={localParam3Value} onChange={(e) => setLocalParam3Value(e.target.value)} placeholder="値" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 text-[11px] font-medium text-gray-400">カスタム入力変数 4</label>
                    <div className="flex items-center gap-1.5">
                      <input type="text" className={INPUT_SM} value={localParam4Name} onChange={(e) => setLocalParam4Name(e.target.value)} placeholder="変数名" />
                      <span className="text-gray-300">=</span>
                      <input type="text" className={INPUT_SM} value={localParam4Value} onChange={(e) => setLocalParam4Value(e.target.value)} placeholder="値" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 出力変数 */}
              <div className="rounded-lg border border-gray-200/80 bg-gray-50/50 px-3 py-2.5">
                <span className="text-[11px] font-semibold text-gray-500 mb-2 block">出力変数</span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 text-[11px] font-medium text-gray-500">マークダウンの出力変数</label>
                    <input type="text" className={INPUT_SM} value={localMdOutput} onChange={(e) => setLocalMdOutput(e.target.value)} placeholder="text" />
                  </div>
                  <div>
                    <label className="mb-1 text-[11px] font-medium text-gray-500">drawの出力変数</label>
                    <input type="text" className={INPUT_SM} value={localDrawioOutput} onChange={(e) => setLocalDrawioOutput(e.target.value)} placeholder="drawio_xml" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 実行ボタン */}
      <div className={`${CARD} mb-5`}>
        <div className="flex items-center gap-3 px-4 py-3">
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
            <>
              <button
                className="flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 shadow-sm hover:bg-purple-100 disabled:opacity-40"
                disabled={!jsonInput.trim() || running || !difyConfigured}
                onClick={async () => {
                  try { JSON.parse(jsonInput); } catch {
                    setError("入力された JSON が不正です。");
                    return;
                  }
                  setRunning(true);
                  setResult(null);
                  setError(null);
                  clearAll();
                  try {
                    const response = await difyUploadOnly(jsonInput);
                    applyResponse(response);
                    if (response.result_json) {
                      const parsed = JSON.parse(response.result_json);
                      setResult({ raw: parsed, status: "succeeded", outputs: parsed, error: undefined });
                    }
                    if (response.error) setError(response.error);
                  } catch (e) {
                    setError(String(e));
                  } finally {
                    setRunning(false);
                  }
                }}
              >
                <Upload size={16} />
                アップロードのみ
              </button>
              <button
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-40"
                disabled={running}
                onClick={handleLoadFile}
              >
                <FolderOpen size={16} />
                ファイル読込
              </button>
            </>
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
            <span className="mt-2 flex items-center gap-1 text-xs text-gray-400">
              <Clock size={12} />
              {elapsed.toFixed(1)}s
            </span>
          </div>
        </div>
      )}

      {/* 結果表示 — タブ切り替え */}
      {hasResult && (
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
                  onClick={() => {
                    setPendingMarkdown(markdownText);
                    navigate("/markdown-editor");
                  }}
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
