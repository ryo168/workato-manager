// Workato API Platform 経由の仕様書生成ページ。
// ファイルアップロード → Workato API Platform 実行 → 結果表示（マークダウン + DrawIO）
//
// 機能:
//   - WorkatoSpecContext によるページ離脱時のstate保持
//   - プロファイルごとのパラメータ自動保存（デバウンス 500ms）
//   - DifyPage と統一されたUI（APIタブ・マークダウンプレビュー・DrawIOプレビュー）
//   - 履歴保存（source: "workato"）

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Server,
  Play,
  AlertCircle,
  Trash2,
  Clock,
  Coins,
  FileText,
  GitGraph,
  Upload,
  Terminal,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileEdit,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import {
  workatoSpecRun,
  saveMarkdownFile,
  saveDrawioFile,
  saveHistoryEntry,
  loadWorkatoSpecConfig,
  saveWorkatoSpecConfig,
} from "../lib/tauri";
import { buildDrawioHtml } from "../lib/drawio";
import { useConfig } from "../context/ConfigContext";
import { useGemini } from "../context/GeminiContext";
import { useWorkatoSpec } from "../context/WorkatoSpecContext";
import type { WorkatoSpecRunPhase } from "../context/WorkatoSpecContext";
import AlertBanner from "../components/AlertBanner";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";
import ApiTabContent from "../components/dify/ApiTabContent";
import { PAGE, HEADER_ROW, CARD, BTN_PRIMARY, BTN_OUTLINED_SM, INPUT_SM, PROSE_MARKDOWN } from "../lib/tw";

export default function WorkatoSpecPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const { setPendingMarkdown } = useGemini();

  // --- Context state（ページ離脱しても保持） ---
  const {
    jsonInput, setJsonInput,
    error, setError,
    running, setRunning,
    runPhase, setRunPhase,
    markdownText, setMarkdownText,
    drawioXml, setDrawioXml,
    httpStatus, setHttpStatus,
    resultStatus, setResultStatus,
    resultElapsed, setResultElapsed,
    resultTokens, setResultTokens,
    resultError, setResultError,
    fileUploadCurl, setFileUploadCurl,
    fileUploadResponse, setFileUploadResponse,
    workflowCurl, setWorkflowCurl,
    workflowResponse, setWorkflowResponse,
  } = useWorkatoSpec();

  // --- パラメータ設定のローカル state ---
  const [localDocType, setLocalDocType] = useState("1");
  const [localWorkatoFlowType, setLocalWorkatoFlowType] = useState("1");
  const [localAddPrompt, setLocalAddPrompt] = useState("");
  const [localUser, setLocalUser] = useState("");
  const [paramSaved, setParamSaved] = useState(false);
  const paramInitialized = useRef(false);
  const activeWapNameRef = useRef("");

  // --- UI state ---
  const [activeTab, setActiveTab] = useState("markdown");
  const [drawioZoom, setDrawioZoom] = useState(100);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // 設定確認
  const activeWap = config?.workato_api_platform_profiles?.find(
    (p) => p.name === config.active_workato_api_platform_profile,
  );
  const activeWfa = config?.workato_file_api_profiles?.find(
    (p) => p.name === config.active_workato_file_api_profile,
  );
  const configured = !!(activeWap?.url && activeWap?.api_token && activeWfa?.url && activeWfa?.api_token);

  // --- プロファイル変更時にパラメータをファイルから読み込む ---
  useEffect(() => {
    if (!activeWap) return;
    paramInitialized.current = false;
    activeWapNameRef.current = activeWap.name;
    loadWorkatoSpecConfig(activeWap.name).then((cfg) => {
      setLocalDocType(cfg.doc_type ?? "1");
      setLocalWorkatoFlowType(cfg.workato_flow_type ?? "1");
      setLocalAddPrompt(cfg.add_prompt ?? "");
      setLocalUser(cfg.user ?? "");
      requestAnimationFrame(() => { paramInitialized.current = true; });
    }).catch(() => {
      requestAnimationFrame(() => { paramInitialized.current = true; });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- activeWap?.name の変更時のみ
  }, [activeWap?.name]);

  // --- デバウンス自動保存（500ms） ---
  useEffect(() => {
    if (!paramInitialized.current) return;
    const profileName = activeWapNameRef.current;
    if (!profileName) return;
    const timer = setTimeout(async () => {
      try {
        await saveWorkatoSpecConfig({
          profile_name: profileName,
          doc_type: localDocType.trim() || undefined,
          workato_flow_type: localWorkatoFlowType.trim() || undefined,
          add_prompt: localAddPrompt.trim() || undefined,
          user: localUser.trim() || undefined,
        });
        setParamSaved(true);
        setTimeout(() => setParamSaved(false), 2000);
      } catch {
        // ignore
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localDocType, localWorkatoFlowType, localAddPrompt, localUser]);

  // タイマー
  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => clearInterval(id);
  }, [running]);

  // フェーズ通知購読
  useEffect(() => {
    const unlisten = listen<string>("workato-spec-phase", (event) => {
      const phase = event.payload as WorkatoSpecRunPhase;
      if (phase === "uploading" || phase === "workflow") {
        setRunPhase(phase);
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, [setRunPhase]);

  // DrawIO HTML
  const drawioHtml = useMemo(
    () => (drawioXml ? buildDrawioHtml(drawioXml) : null),
    [drawioXml],
  );

  // タブ定義
  const tabs = useMemo(() => {
    const t: { id: string; label: string; icon: React.ReactNode }[] = [];
    if (markdownText) t.push({ id: "markdown", label: "マークダウン", icon: React.createElement(FileText, { size: 14 }) });
    if (drawioHtml) t.push({ id: "drawio", label: "draw.io", icon: React.createElement(GitGraph, { size: 14 }) });
    t.push({ id: "file-api", label: "ファイルAPI", icon: React.createElement(Upload, { size: 14 }) });
    t.push({ id: "workflow-api", label: "ワークフローAPI", icon: React.createElement(Terminal, { size: 14 }) });
    return t;
  }, [markdownText, drawioHtml]);

  const effectiveTab = tabs.find((t) => t.id === activeTab)
    ? activeTab
    : tabs.find((t) => t.id === "markdown")
      ? "markdown"
      : (tabs[0]?.id ?? "markdown");

  // --- クリア ---
  const clearAll = useCallback(() => {
    setFileUploadCurl(null);
    setFileUploadResponse(null);
    setWorkflowCurl(null);
    setWorkflowResponse(null);
  }, [setFileUploadCurl, setFileUploadResponse, setWorkflowCurl, setWorkflowResponse]);

  // --- 実行 ---
  const handleRunClick = useCallback(() => {
    if (!jsonInput.trim()) return;
    try { JSON.parse(jsonInput); } catch {
      setError("入力された JSON が不正です。正しい JSON を入力してください。");
      return;
    }
    setConfirmOpen(true);
  }, [jsonInput, setError]);

  const handleRunConfirm = useCallback(async () => {
    setConfirmOpen(false);
    setRunning(true);
    setRunPhase("uploading");
    setError(null);
    setMarkdownText(null);
    setDrawioXml(null);
    setHttpStatus(0);
    setResultStatus(null);
    setResultElapsed(undefined);
    setResultTokens(undefined);
    setResultError(undefined);
    setActiveTab("markdown");
    clearAll();

    let md: string | null = null;
    let dx: string | null = null;
    let status: string | undefined;
    let elapsedTime: number | undefined;
    let totalTokens: number | undefined;
    let runError: string | null = null;

    try {
      const response = await workatoSpecRun(
        jsonInput,
        localDocType,
        localWorkatoFlowType,
        localAddPrompt,
        localUser,
      );

      // APIタブ用データ
      setFileUploadCurl(response.file_upload_curl || null);
      setFileUploadResponse(response.file_upload_response || null);
      setWorkflowCurl(response.workflow_curl || null);
      setWorkflowResponse(response.workflow_response || null);

      if (response.http_status) {
        setHttpStatus(response.http_status);
      }

      if (response.error) {
        runError = response.error;
        setError(response.error);
      }

      if (response.response_json) {
        try {
          const parsed = JSON.parse(response.response_json);
          const data = parsed?.data;
          const outputs = data?.outputs;
          status = data?.status ?? "unknown";
          elapsedTime = data?.elapsed_time;
          totalTokens = data?.total_tokens;
          setResultStatus(status ?? null);
          setResultElapsed(elapsedTime);
          setResultTokens(totalTokens);

          if (data?.error && data.error !== "") {
            setResultError(data.error);
          }

          if (outputs?.spec && typeof outputs.spec === "string" && outputs.spec.trim()) {
            md = outputs.spec;
            setMarkdownText(md);
          }
          if (outputs?.xml && typeof outputs.xml === "string" && outputs.xml.trim()) {
            dx = outputs.xml;
            setDrawioXml(dx);
          }

          // Workato レシピ側のバリデーションエラー
          if (parsed?.message && !outputs) {
            runError = parsed.message;
            setError(parsed.message);
          }
        } catch {
          // JSONパース失敗
        }
      }
    } catch (e) {
      runError = String(e);
      setError(runError);
    } finally {
      setRunning(false);
      setRunPhase("idle");

      // 履歴保存（fire-and-forget）
      saveHistoryEntry({
        status: status ?? (runError ? "failed" : "unknown"),
        error: runError ?? undefined,
        elapsed_time: elapsedTime,
        total_tokens: totalTokens,
        markdown: md,
        drawio: dx,
        source: "workato",
      }).catch(() => {});
    }
  }, [jsonInput, localDocType, localWorkatoFlowType, localAddPrompt, localUser, clearAll,
      setRunning, setRunPhase, setError, setMarkdownText, setDrawioXml, setHttpStatus,
      setResultStatus, setResultElapsed, setResultTokens, setResultError,
      setFileUploadCurl, setFileUploadResponse, setWorkflowCurl, setWorkflowResponse]);

  const handleClear = useCallback(() => {
    setJsonInput("");
    setError(null);
    setMarkdownText(null);
    setDrawioXml(null);
    setHttpStatus(0);
    setResultStatus(null);
    setResultElapsed(undefined);
    setResultTokens(undefined);
    setResultError(undefined);
    clearAll();
  }, [setJsonInput, setError, setMarkdownText, setDrawioXml, setHttpStatus,
      setResultStatus, setResultElapsed, setResultTokens, setResultError, clearAll]);

  const hasResult = markdownText || drawioXml || fileUploadCurl || fileUploadResponse || workflowCurl || workflowResponse || error;

  return (
    <div className={PAGE}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25">
            <Server size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-600">仕様書生成</h1>
            <p className="text-xs text-gray-400 mt-0.5">Workato API Platform 経由で Dify ワークフローを実行</p>
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

      {/* 未設定の場合 */}
      {!configured && (
        <AlertBanner severity="warning" className="mb-6">
          Workato API Platform または Workato File API の設定がされていません。Settings ページで設定してください。
        </AlertBanner>
      )}

      {/* パラメータ設定 */}
      {activeWap && (
        <div className={`${CARD} mb-6`}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-600">パラメータ設定</h3>
            {paramSaved && (
              <span className="text-xs text-emerald-500 animate-pulse">保存しました</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 p-5">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">ドキュメントタイプ</label>
              <input className={INPUT_SM} value={localDocType} onChange={(e) => setLocalDocType(e.target.value)} placeholder="1" disabled={running} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">ワークフロータイプ</label>
              <input className={INPUT_SM} value={localWorkatoFlowType} onChange={(e) => setLocalWorkatoFlowType(e.target.value)} placeholder="1" disabled={running} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">ユーザー</label>
              <input className={INPUT_SM} value={localUser} onChange={(e) => setLocalUser(e.target.value)} placeholder="user-001" disabled={running} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">追加プロンプト</label>
              <input className={INPUT_SM} value={localAddPrompt} onChange={(e) => setLocalAddPrompt(e.target.value)} placeholder="任意の追加指示" disabled={running} />
            </div>
          </div>
        </div>
      )}

      {/* JSON入力 */}
      <div className={`${CARD} mb-6`}>
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-600">JSON 入力</h3>
        </div>
        <div className="p-5">
          <textarea
            className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 font-mono text-sm text-gray-700 focus:border-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-200 min-h-[120px] resize-y"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='{"connections": [...], "recipes": [...], ...}'
            disabled={running}
          />
        </div>
      </div>

      {/* 実行ボタン */}
      <div className={`${CARD} mb-6`}>
        <div className="flex items-center gap-3 px-5 py-3.5">
          <button
            className={BTN_PRIMARY}
            disabled={!jsonInput.trim() || running || !configured}
            onClick={handleRunClick}
          >
            {running ? <Spinner size={16} /> : <Play size={16} />}
            {running
              ? runPhase === "uploading" ? "アップロード中" : "ワークフロー実行中"
              : "実行"}
          </button>
          {running && (
            <span className="text-xs text-gray-400">
              {runPhase === "uploading"
                ? "ファイルをアップロードしています..."
                : "Workato API Platform でワークフローを実行しています..."}
            </span>
          )}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <AlertBanner severity="error" className="mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span className="whitespace-pre-wrap">{error}</span>
          </div>
        </AlertBanner>
      )}

      {/* 実行中アニメーション */}
      {running && (
        <div className={`${CARD} mb-6`}>
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner size={48} />
            <p className="mt-4 text-sm text-gray-500 animate-pulse">
              {runPhase === "uploading"
                ? "ファイルをアップロードしています..."
                : "ワークフローを実行しています..."}
            </p>
            <span className="mt-1 text-xs font-medium text-cyan-500">
              {runPhase === "uploading" ? "Step 1/2 — ファイルAPI" : "Step 2/2 — ワークフロー"}
            </span>
            <span className="mt-2 flex items-center gap-1 text-xs text-gray-400">
              <Clock size={12} />
              {elapsed.toFixed(1)}s
            </span>
          </div>
        </div>
      )}

      {/* ===== 結果表示 ===== */}
      {hasResult && !running && (
        <div className={`${CARD} mb-6`}>
          {/* ヘッダー: ステータス & メタ情報 */}
          <div className="flex items-center justify-between bg-gray-100 px-5 py-3.5 rounded-t-lg border-b border-gray-200">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-gray-700">実行結果</span>
            </div>
            <div className="flex items-center gap-3">
              {httpStatus > 0 && (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  httpStatus >= 200 && httpStatus < 300 ? "bg-emerald-100 text-emerald-700" :
                  httpStatus >= 400 && httpStatus < 500 ? "bg-amber-100 text-amber-700" :
                  httpStatus >= 500 ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  HTTP {httpStatus}
                </span>
              )}
              {(resultElapsed != null || resultTokens != null) && (
                <div className="flex gap-4 text-xs text-gray-500">
                  {resultElapsed != null && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-gray-400" />
                      {resultElapsed.toFixed(2)}s
                    </span>
                  )}
                  {resultTokens != null && (
                    <span className="flex items-center gap-1">
                      <Coins size={12} className="text-gray-400" />
                      {Math.round(resultTokens).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              {resultStatus && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  resultStatus === "succeeded"
                    ? "bg-green-100 text-green-700"
                    : resultStatus === "failed"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-600"
                }`}>
                  {resultStatus}
                </span>
              )}
            </div>
          </div>

          {/* ワークフローエラー表示 */}
          {resultStatus === "failed" && resultError && (
            <div className="border-b border-gray-100 px-5 py-3.5">
              <AlertBanner severity="error">{resultError}</AlertBanner>
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
                      ? "border-cyan-500 text-cyan-600"
                      : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* マークダウン */}
          {effectiveTab === "markdown" && markdownText && (
            <div>
              <div className="flex items-center justify-end gap-2 px-5 pt-4">
                <button
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-teal-600 hover:bg-teal-100/60"
                  onClick={() => {
                    if (markdownText) {
                      setPendingMarkdown(markdownText);
                      navigate("/markdown-editor");
                    }
                  }}
                  title="マークダウンエディタで編集"
                >
                  <FileEdit size={14} />
                  編集
                </button>
                <button
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-100/60"
                  onClick={() => saveMarkdownFile("仕様書.md", markdownText)}
                  title="Markdownファイルとして保存"
                >
                  <Download size={14} />
                  保存
                </button>
              </div>
              <div className={PROSE_MARKDOWN}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {markdownText}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* draw.io */}
          {effectiveTab === "drawio" && drawioHtml && drawioXml && (
            <div>
              <div className="flex items-center justify-between px-5 pt-4">
                <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-1">
                  <button className="rounded p-1 text-gray-500 hover:bg-gray-100" onClick={() => setDrawioZoom((z) => Math.max(20, z - 10))} title="縮小">
                    <ZoomOut size={14} />
                  </button>
                  <span className="min-w-[3rem] text-center text-xs font-medium text-gray-600">{drawioZoom}%</span>
                  <button className="rounded p-1 text-gray-500 hover:bg-gray-100" onClick={() => setDrawioZoom((z) => Math.min(300, z + 10))} title="拡大">
                    <ZoomIn size={14} />
                  </button>
                  <button className="rounded p-1 text-gray-500 hover:bg-gray-100" onClick={() => setDrawioZoom(100)} title="リセット">
                    <Maximize2 size={14} />
                  </button>
                </div>
                <button
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-100/60"
                  onClick={() => saveDrawioFile("フローチャート.drawio", drawioXml)}
                  title="Draw.ioファイルとして保存"
                >
                  <Download size={14} />
                  保存
                </button>
              </div>
              <div className="overflow-auto px-5 py-5" style={{ maxHeight: 600 }}>
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
            <ApiTabContent curlCmd={fileUploadCurl} responseText={fileUploadResponse} />
          )}

          {/* ワークフローAPI */}
          {effectiveTab === "workflow-api" && (
            <ApiTabContent curlCmd={workflowCurl} responseText={workflowResponse} />
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
            <button className={BTN_OUTLINED_SM} onClick={() => setConfirmOpen(false)}>キャンセル</button>
            <button className={BTN_PRIMARY} onClick={handleRunConfirm}><Play size={16} />実行</button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Workato API Platform 経由で仕様書生成を実行しますか？</p>
      </Modal>
    </div>
  );
}
