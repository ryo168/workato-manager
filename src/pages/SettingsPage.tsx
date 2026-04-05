// 設定ページ。接続設定（Workato / Dify / Gemini / Workato File API）と共通設定。

import { useState, useCallback, useEffect, useRef } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  CheckCircle,
  Save,
  FolderOpen,
  Settings,
  Workflow,
  Globe,
  Sparkles,
  Upload,
  Server,
} from "lucide-react";
import { useProfileEditor } from "../hooks/useProfileEditor";
import type { EditRow, DifyEditRow, GeminiEditRow, WorkatoFileApiEditRow, WorkatoApiPlatformEditRow } from "../hooks/useProfileEditor";
import type { Profile, DifyProfile, GeminiProfile, WorkatoFileApiProfile, WorkatoApiPlatformProfile } from "../types/workato";
import { getLogDir, getConfigDir, openFolder } from "../lib/tauri";
import AlertBanner from "../components/AlertBanner";
import Modal from "../components/Modal";
import ProfileSection from "../components/settings/ProfileSection";
import SectionHeader from "../components/settings/SectionHeader";
import type { ColumnDef } from "../components/settings/ProfileTable";
import { createNameColumn, createTextColumn, createSelectColumn } from "../components/settings/columnHelpers";
import { ZOOM_LEVELS, DEFAULT_ZOOM } from "../constants/settings";
import {
  BTN_PRIMARY,
  BTN_OUTLINED_SM,
  CARD,
  PAGE,
  HEADER_ROW,
  INPUT_SM,
  SELECT_SM,
} from "../lib/tw";

// ---------- 列定義 ----------

const WORKATO_COLUMNS: ColumnDef<Profile, EditRow>[] = [
  createNameColumn<Profile, EditRow>(),
  createTextColumn<Profile, EditRow>("Base URL", (p) => p.base_url, "base_url", "https://app.trial.workato.com"),
  createTextColumn<Profile, EditRow>("APIトークン", (p) => p.api_token, "api_token", "APIトークン", { mono: true, password: true, viewClass: "text-xs text-gray-400" }),
];

const DIFY_COLUMNS: ColumnDef<DifyProfile, DifyEditRow>[] = [
  createNameColumn<DifyProfile, DifyEditRow>(),
  createTextColumn<DifyProfile, DifyEditRow>("API URL", (p) => p.base_url || "", "base_url", "https://api.dify.ai/v1"),
  createTextColumn<DifyProfile, DifyEditRow>("APIキー", (p) => p.api_key, "api_key", "app-xxxxxxxx", { mono: true, password: true, viewClass: "text-xs text-gray-400" }),
];

const WFA_COLUMNS: ColumnDef<WorkatoFileApiProfile, WorkatoFileApiEditRow>[] = [
  createNameColumn<WorkatoFileApiProfile, WorkatoFileApiEditRow>(),
  createTextColumn<WorkatoFileApiProfile, WorkatoFileApiEditRow>("API URL", (p) => p.url || "", "url", "https://apim.workato.com/..."),
  createTextColumn<WorkatoFileApiProfile, WorkatoFileApiEditRow>("APIトークン", (p) => p.api_token, "api_token", "api-token", { mono: true, password: true, viewClass: "text-xs text-gray-400" }),
];

const GEMINI_COLUMNS: ColumnDef<GeminiProfile, GeminiEditRow>[] = [
  createNameColumn<GeminiProfile, GeminiEditRow>(),
  createTextColumn<GeminiProfile, GeminiEditRow>("APIキー", (p) => p.api_key, "api_key", "AIza...", { mono: true, password: true, viewClass: "text-xs text-gray-400" }),
  createSelectColumn<GeminiProfile, GeminiEditRow>("モデル", (p) => p.model || "gemini-2.5-flash", "model", [
    { label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
    { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro" },
    { label: "Gemini 2.0 Flash", value: "gemini-2.0-flash" },
    { label: "Gemini 1.5 Pro", value: "gemini-1.5-pro" },
    { label: "Gemini 1.5 Flash", value: "gemini-1.5-flash" },
  ]),
];

const WAP_COLUMNS: ColumnDef<WorkatoApiPlatformProfile, WorkatoApiPlatformEditRow>[] = [
  createNameColumn<WorkatoApiPlatformProfile, WorkatoApiPlatformEditRow>(),
  createTextColumn<WorkatoApiPlatformProfile, WorkatoApiPlatformEditRow>("API URL", (p) => p.url || "", "url", "https://apim.jp.workato.com/..."),
  createTextColumn<WorkatoApiPlatformProfile, WorkatoApiPlatformEditRow>("APIトークン", (p) => p.api_token, "api_token", "api-token", { mono: true, password: true, viewClass: "text-xs text-gray-400" }),
];

// ---------- セクション定義 ----------

interface SectionDef {
  key: "workato" | "dify" | "wfa" | "gemini" | "wap";
  icon: React.ReactNode;
  label: string;
  description: string;
  theme: "orange" | "blue" | "indigo" | "purple" | "cyan";
  headerColor: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<any, any>[];
  emptyMessage: string;
}

const SECTIONS: SectionDef[] = [
  {
    key: "workato",
    icon: <Workflow size={14} className="text-orange-500" />,
    label: "Workato",
    description: "Workato API の接続先プロファイル。レシピの管理・実行に使用します。",
    theme: "orange",
    headerColor: "bg-orange-100/80",
    columns: WORKATO_COLUMNS,
    emptyMessage: "プロファイルがありません。「追加」から追加してください。",
  },
  {
    key: "dify",
    icon: <Globe size={14} className="text-blue-500" />,
    label: "Dify",
    description: "Dify ワークフロー API の接続先プロファイル。ドキュメント変換などに使用します。",
    theme: "blue",
    headerColor: "bg-blue-100/80",
    columns: DIFY_COLUMNS,
    emptyMessage: "Dify プロファイルがありません。「追加」から追加してください。",
  },
  {
    key: "gemini",
    icon: <Sparkles size={14} className="text-purple-500" />,
    label: "Gemini",
    description: "Google Gemini API の接続先プロファイル。AI によるテキスト生成・要約に使用します。",
    theme: "purple",
    headerColor: "bg-purple-100/80",
    columns: GEMINI_COLUMNS,
    emptyMessage: "Gemini プロファイルがありません。「追加」から追加してください。",
  },
  {
    key: "wfa",
    icon: <Upload size={14} className="text-indigo-500" />,
    label: "Spec Generator API File",
    description: "仕様書生成のファイルアップロード API の接続先プロファイル。",
    theme: "indigo",
    headerColor: "bg-indigo-100/80",
    columns: WFA_COLUMNS,
    emptyMessage: "Spec Generator API File プロファイルがありません。「追加」から追加してください。",
  },
  {
    key: "wap",
    icon: <Server size={14} className="text-cyan-500" />,
    label: "Spec Generator API WorkFlow",
    description: "仕様書生成のワークフロー実行 API の接続先プロファイル。仕様書生成に使用します。",
    theme: "cyan",
    headerColor: "bg-cyan-100/80",
    columns: WAP_COLUMNS,
    emptyMessage: "Spec Generator API WorkFlow プロファイルがありません。「追加」から追加してください。",
  },
];

// ---------- メインコンポーネント ----------

export default function SettingsPage() {
  // ズーム設定
  const [zoomLevel, setZoomLevel] = useState(() => localStorage.getItem("app-zoom") || DEFAULT_ZOOM);

  const handleZoomChange = useCallback((value: string) => {
    setZoomLevel(value);
    localStorage.setItem("app-zoom", value);
    const factor = parseFloat(value) / 100;
    if (factor > 0) getCurrentWebviewWindow().setZoom(factor);
  }, []);

  const { workato, dify, gemini, wfa, wap, common } = useProfileEditor();
  const { proxyUrl, setProxyUrl, saving, saved, error, handleSave, dirty } = common;

  // 未保存状態の警告モーダル
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);
  const pendingNavRef = useRef<(() => void) | null>(null);

  // beforeunload（ブラウザ/Tauriのリロード対策）
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // サイドバーのナビゲーションをインターセプトするカスタムイベント
  useEffect(() => {
    const handler = (e: CustomEvent<{ proceed: () => void }>) => {
      if (dirty) {
        e.preventDefault();
        pendingNavRef.current = e.detail.proceed;
        setUnsavedModalOpen(true);
      }
    };
    window.addEventListener("settings-nav-guard", handler as EventListener);
    return () => window.removeEventListener("settings-nav-guard", handler as EventListener);
  }, [dirty]);

  // CRUD を key で引ける map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const crudMap: Record<string, any> = { workato, dify, gemini, wfa, wap };

  // Ctrl+S で保存
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  return (
    <div className={PAGE}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gray-600 to-gray-700 text-white shadow-lg shadow-gray-600/25">
            <Settings size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-600">Settings</h1>
            <p className="text-xs text-gray-400 mt-0.5">接続先プロファイル・共通設定の管理</p>
          </div>
        </div>
        <button className={BTN_PRIMARY} disabled={saving} onClick={handleSave}>
          {saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saved ? "保存しました" : saving ? "保存中..." : "保存"}
        </button>
      </div>

      {error && <AlertBanner severity="error" className="mb-6">{error}</AlertBanner>}

      <div className="space-y-8">
        {/* === 共通設定 === */}
        <div className={CARD}>
          <SectionHeader icon={<Settings size={14} className="text-gray-500" />} label="共通設定" color="bg-gray-100/80" description="全サービス共通の設定項目です。" />
          <div className="p-5 space-y-6">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">プロキシ URL</label>
              <input type="text" className={`${INPUT_SM} max-w-md`} value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} placeholder="http://proxy:8080" />
              <p className="mt-1.5 text-xs text-gray-400">Workato・Dify・Gemini 共通のHTTPプロキシ設定です。不要な場合は空欄にしてください。</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">画面の拡大率</label>
              <select className={`${SELECT_SM} max-w-[160px]`} value={zoomLevel} onChange={(e) => handleZoomChange(e.target.value)}>
                {ZOOM_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}%</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-400">アプリ全体の表示倍率を変更します。</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">データフォルダ</label>
              <div className="flex gap-3">
                <button className={BTN_OUTLINED_SM} onClick={async () => { const dir = await getLogDir(); await openFolder(dir); }}>
                  <FolderOpen size={16} className="text-amber-500" />ログフォルダを開く
                </button>
                <button className={BTN_OUTLINED_SM} onClick={async () => { const dir = await getConfigDir(); await openFolder(dir); }}>
                  <FolderOpen size={16} className="text-amber-500" />設定フォルダを開く
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* === 接続設定 === */}
        {SECTIONS.map((sec) => (
          <ProfileSection
            key={sec.key}
            icon={sec.icon}
            label={sec.label}
            description={sec.description}
            theme={sec.theme}
            headerColor={sec.headerColor}
            columns={sec.columns}
            crud={crudMap[sec.key]}
            emptyMessage={sec.emptyMessage}
          />
        ))}
      </div>

      {/* 未保存警告モーダル */}
      <Modal
        open={unsavedModalOpen}
        onClose={() => { setUnsavedModalOpen(false); pendingNavRef.current = null; }}
        title="設定値がほぞんされてへんよ🤦‍♂️"
        maxWidth="max-w-sm"
        footer={<>
          <button className={BTN_OUTLINED_SM} onClick={() => { setUnsavedModalOpen(false); pendingNavRef.current?.(); pendingNavRef.current = null; }}>保存せず移動</button>
          <button className={BTN_PRIMARY} onClick={() => { setUnsavedModalOpen(false); pendingNavRef.current = null; }}>
            戻って保存する
          </button>
        </>}
      >
        <p className="text-sm text-gray-600">編集中の設定が保存されていません。このまま移動すると変更が失われます。</p>
      </Modal>
    </div>
  );
}
