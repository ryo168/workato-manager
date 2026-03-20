// Dify ワークフロー実行ページのロジックを集約した Custom Hook。
// DifyPage から全ての状態管理・副作用・コールバックを抽出している。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, GitGraph, Upload, Terminal } from "lucide-react";
import React from "react";

import { difyRun, difyUploadOnly, difyLoadResponse, saveHistoryEntry } from "../lib/tauri";
import { buildDrawioHtml } from "../lib/drawio";
import { useConfig } from "../context/ConfigContext";
import { useDify } from "../context/DifyContext";
import { useGemini } from "../context/GeminiContext";

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

export function useDifyWorkflow() {
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
    fileUploadResponse,
    setFileUploadResponse,
    fileUploadCurl,
    setFileUploadCurl,
    workflowResponse,
    setWorkflowResponse,
    workflowCurl,
    setWorkflowCurl,
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
    if (markdownText) t.push({ id: "markdown", label: "マークダウン", icon: React.createElement(FileText, { size: 14 }) });
    if (drawioHtml) t.push({ id: "drawio", label: "draw.io", icon: React.createElement(GitGraph, { size: 14 }) });
    t.push({ id: "file-api", label: "ファイルAPI", icon: React.createElement(Upload, { size: 14 }) });
    t.push({ id: "workflow-api", label: "ワークフローAPI", icon: React.createElement(Terminal, { size: 14 }) });
    return t;
  }, [markdownText, drawioHtml]);

  // activeTab が現在の tabs に存在しない場合のフォールバック
  const effectiveTab = tabs.find((t) => t.id === activeTab)
    ? activeTab
    : tabs.find((t) => t.id === "markdown")
      ? "markdown"
      : (tabs[0]?.id ?? "markdown");

  /** 全state をクリアするヘルパー */
  const clearAll = useCallback(() => {
    setFileUploadResponse(null);
    setFileUploadCurl(null);
    setWorkflowResponse(null);
    setWorkflowCurl(null);
  }, [setFileUploadResponse, setFileUploadCurl, setWorkflowResponse, setWorkflowCurl]);

  /** レスポンスから state をセットするヘルパー */
  const applyResponse = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (response: any) => {
      setFileUploadResponse(response.file_upload_response || null);
      setFileUploadCurl(response.file_upload_curl || null);
      setWorkflowResponse(response.workflow_response || null);
      setWorkflowCurl(response.workflow_curl || null);
    },
    [setFileUploadResponse, setFileUploadCurl, setWorkflowResponse, setWorkflowCurl],
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

  const handleUploadOnly = useCallback(async () => {
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
  }, [jsonInput, setRunning, setResult, setError, clearAll, applyResponse]);

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

  return {
    // Context state
    jsonInput,
    setJsonInput,
    result,
    error,
    running,
    setRunning,
    setResult,
    setError,
    fileUploadCurl,
    fileUploadResponse,
    workflowCurl,
    workflowResponse,

    // Local state
    drawioZoom,
    setDrawioZoom,
    activeTab,
    setActiveTab,
    confirmOpen,
    setConfirmOpen,
    elapsed,
    localFileInput,
    setLocalFileInput,
    localMdOutput,
    setLocalMdOutput,
    localDrawioOutput,
    setLocalDrawioOutput,
    localParam1Name,
    setLocalParam1Name,
    localParam1Value,
    setLocalParam1Value,
    localParam2Name,
    setLocalParam2Name,
    localParam2Value,
    setLocalParam2Value,
    localParam3Name,
    setLocalParam3Name,
    localParam3Value,
    setLocalParam3Value,
    localParam4Name,
    setLocalParam4Name,
    localParam4Value,
    setLocalParam4Value,
    localWorkatoFileIdParam,
    setLocalWorkatoFileIdParam,
    localFileApiMode,
    setLocalFileApiMode,
    paramSaved,

    // Derived
    isDev,
    activeDify,
    difyConfigured,
    markdownText,
    drawioXml,
    drawioHtml,
    tabs,
    effectiveTab,
    hasResult,

    // Callbacks
    handleRunClick,
    handleRunConfirm,
    handleUploadOnly,
    handleClear,
    handleLoadFile,
    clearAll,
    applyResponse,

    // Gemini
    setPendingMarkdown,
  };
}
