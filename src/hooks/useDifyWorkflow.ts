/**
 * useDifyWorkflow — Dify ワークフロー実行ページのロジックを集約した Custom Hook。
 *
 * 責務:
 *   - パラメータ設定のローカル state 管理とプロファイルへの自動保存
 *   - ワークフロー実行（Run / UploadOnly / LoadFile）と結果パース
 *   - マークダウン・DrawIO 出力の抽出と整形
 *   - タブ制御・経過時間タイマーなどの UI state
 *
 * DifyPage から全ての状態管理・副作用・コールバックを抽出している。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, GitGraph, Upload, Terminal } from "lucide-react";
import React from "react";

import { listen } from "@tauri-apps/api/event";
import { difyRun, difyUploadOnly, difyLoadResponse, saveHistoryEntry, loadDifyWorkflowConfig, saveDifyWorkflowConfig } from "../lib/tauri";
import { buildDrawioHtml } from "../lib/drawio";
import { useConfig } from "../context/ConfigContext";
import { useDify } from "../context/DifyContext";
import type { DifyRunPhase } from "../context/DifyContext";
import { useGemini } from "../context/GeminiContext";

import type { WorkflowResult } from "../types/workato";

/**
 * Dify API レスポンス（生 JSON）を WorkflowResult 型に正規化する。
 * data プロパティが無い場合やパースに失敗した場合もエラー情報を保持して返す。
 */
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

/**
 * Dify が改行なしの一行マークダウンを返すことがあるため、
 * 見出し・テーブル・リスト・区切り線の境界に改行を挿入して可読性を確保する。
 * 既に改行を含むテキストにはノータッチ（二重整形を防止）。
 */
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
  // --- 外部 Context の取得 ---
  const { setPendingMarkdown } = useGemini();
  const { config } = useConfig();
  const {
    jsonInput,
    setJsonInput,
    result,
    setResult,
    error,
    setError,
    running,
    setRunning,
    runPhase,
    setRunPhase,
    fileUploadResponse,
    setFileUploadResponse,
    fileUploadCurl,
    setFileUploadCurl,
    workflowResponse,
    setWorkflowResponse,
    workflowCurl,
    setWorkflowCurl,
  } = useDify();

  // --- UI state（表示制御・ダイアログ・タイマー） ---
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

  // Rust 側からのフェーズ通知を購読して runPhase を更新
  useEffect(() => {
    const unlisten = listen<string>("dify-phase", (event) => {
      const phase = event.payload as DifyRunPhase;
      if (phase === "uploading" || phase === "workflow") {
        setRunPhase(phase);
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, [setRunPhase]);

  const isDev = localStorage.getItem("developer-mode") === "true";

  const activeDify = config?.dify_profiles?.find(
    (p) => p.name === config.active_dify_profile,
  );
  const difyConfigured = !!(activeDify?.base_url && activeDify?.api_key);

  // --- パラメータ設定のローカル state ---
  // パラメータ名・値のローカルコピー。ユーザー入力を即座に反映し、
  // デバウンス後にプロファイルへ自動保存する。
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
  // プロファイル切替時の初期化が完了するまで自動保存を抑止するフラグ
  const paramInitialized = useRef(false);
  // デバウンス自動保存で最新のプロファイル名を参照するための ref
  const activeDifyNameRef = useRef(activeDify?.name ?? "");

  // アクティブプロファイル変更時に dify_workflow_config.json からパラメータを読み込む。
  useEffect(() => {
    if (!activeDify) return;
    paramInitialized.current = false;
    activeDifyNameRef.current = activeDify.name;
    loadDifyWorkflowConfig(activeDify.name).then((wf) => {
      setLocalFileInput(wf.file_input_name ?? "");
      setLocalMdOutput(wf.markdown_output_name ?? "");
      setLocalDrawioOutput(wf.drawio_output_name ?? "");
      setLocalParam1Name(wf.param1_name ?? "");
      setLocalParam1Value(wf.param1_value ?? "");
      setLocalParam2Name(wf.param2_name ?? "");
      setLocalParam2Value(wf.param2_value ?? "");
      setLocalParam3Name(wf.param3_name ?? "");
      setLocalParam3Value(wf.param3_value ?? "");
      setLocalParam4Name(wf.param4_name ?? "");
      setLocalParam4Value(wf.param4_value ?? "");
      setLocalWorkatoFileIdParam(wf.workato_file_id_param ?? "");
      setLocalFileApiMode(wf.file_api_mode ?? "dify");
      requestAnimationFrame(() => { paramInitialized.current = true; });
    }).catch(() => {
      // 読み込み失敗時はデフォルト値のまま
      requestAnimationFrame(() => { paramInitialized.current = true; });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- activeDify?.name の変更時のみ再初期化
  }, [activeDify?.name]);

  // デバウンス自動保存（500ms）。
  // キー入力のたびにファイル I/O が走るのを防ぐため 500ms の遅延を設ける。
  // paramInitialized が false の間（プロファイル切替直後）は保存をスキップし、
  // 初期同期と自動保存の競合を回避する。
  useEffect(() => {
    if (!paramInitialized.current) return;
    const profileName = activeDifyNameRef.current;
    if (!profileName) return;
    const timer = setTimeout(async () => {
      try {
        await saveDifyWorkflowConfig({
          profile_name: profileName,
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
        });
        setParamSaved(true);
        setTimeout(() => setParamSaved(false), 2000);
      } catch {
        // ignore
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localFileInput, localMdOutput, localDrawioOutput, localWorkatoFileIdParam, localParam1Name, localParam1Value, localParam2Name, localParam2Value, localParam3Name, localParam3Value, localParam4Name, localParam4Value, localFileApiMode]);

  // --- 結果系の派生 state ---
  // outputs からマークダウン / DrawIO テキストを抽出する。
  // キー名はユーザーがパラメータ設定で指定した値を使い、未設定ならデフォルトにフォールバック。
  const mdOutputKey = localMdOutput.trim() || "text";
  const drawioOutputKey = localDrawioOutput.trim() || "drawio_xml";

  // ワークフロー結果の outputs から指定キーの値を取り出し、
  // fixMarkdownNewlines で改行を補完してから返す。値が空文字や非文字列なら null。
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
    setRunPhase("uploading");
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
      setRunPhase("idle");

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
  }, [jsonInput, setRunning, setRunPhase, setResult, setError, clearAll, applyResponse, localMdOutput, localDrawioOutput]);

  const handleUploadOnly = useCallback(async () => {
    try { JSON.parse(jsonInput); } catch {
      setError("入力された JSON が不正です。");
      return;
    }
    setRunning(true);
    setRunPhase("uploading");
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
      setRunPhase("idle");
    }
  }, [jsonInput, setRunning, setRunPhase, setResult, setError, clearAll, applyResponse]);

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

  // --- 公開インターフェース ---
  return {
    // Context state（DifyContext から透過的に公開）
    jsonInput,
    setJsonInput,
    result,
    error,
    running,
    runPhase,
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

    // Derived（useMemo / 算出値）
    isDev,
    activeDify,
    difyConfigured,
    markdownText,
    drawioXml,
    drawioHtml,
    tabs,
    effectiveTab,
    hasResult,

    // Callbacks（ワークフロー実行・クリア・ファイル読み込み）
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
