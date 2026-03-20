// 設定ページ。接続設定（Workato / Dify / Gemini / Workato File API）と共通設定。

import { useState, useCallback, useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  CheckCircle,
  Save,
  FolderOpen,
  Settings,
  Lock,
  Workflow,
  Globe,
  Sparkles,
  Upload,
  Plug,
} from "lucide-react";
import { useProfileEditor } from "../hooks/useProfileEditor";
import type { EditRow, DifyEditRow, GeminiEditRow, WorkatoFileApiEditRow } from "../hooks/useProfileEditor";
import type { Profile, DifyProfile, GeminiProfile, WorkatoFileApiProfile } from "../types/workato";
import { getLogDir, getConfigDir, openFolder } from "../lib/tauri";
import { maskToken } from "../lib/format";
import AlertBanner from "../components/AlertBanner";
import Modal from "../components/Modal";
import SectionHeader from "../components/settings/SectionHeader";
import ProfileTable from "../components/settings/ProfileTable";
import type { ColumnDef } from "../components/settings/ProfileTable";
import {
  BTN_PRIMARY,
  BTN_OUTLINED_SM,
  CARD,
  PAGE,
  HEADER_ROW,
  INPUT_SM,
  SELECT_SM,
} from "../lib/tw";

const DEVELOPER_HASH = "524beeec873cb78924f03e60f2b9a7313873df5881f0654eaead2d581336e643";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type SettingsTab = "connections" | "general";

const TAB_DEFS: { id: SettingsTab; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
  { id: "connections", label: "接続設定", icon: <Plug size={15} />, color: "text-gray-500", activeColor: "border-primary text-primary" },
  { id: "general", label: "共通設定", icon: <Settings size={15} />, color: "text-gray-500", activeColor: "border-gray-600 text-gray-700" },
];

// ---------- 列定義 ----------

const WORKATO_COLUMNS: ColumnDef<Profile, EditRow>[] = [
  {
    header: "名前",
    renderView: (p) => <span className="font-medium">{p.name}</span>,
    renderEdit: (row, set) => <input type="text" className={INPUT_SM} value={row.name} onChange={(e) => set((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" />,
    renderAdd: (row, set) => <input type="text" className={INPUT_SM} value={row.name} onChange={(e) => set((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" autoFocus />,
  },
  {
    header: "Base URL",
    renderView: (p) => <span className="text-xs text-gray-500">{p.base_url}</span>,
    renderEdit: (row, set) => <input type="text" className={INPUT_SM} value={row.base_url} onChange={(e) => set((r) => ({ ...r, base_url: e.target.value }))} placeholder="https://app.trial.workato.com" />,
    renderAdd: (row, set) => <input type="text" className={INPUT_SM} value={row.base_url} onChange={(e) => set((r) => ({ ...r, base_url: e.target.value }))} placeholder="https://app.trial.workato.com" />,
  },
  {
    header: "APIトークン",
    renderView: (p) => <span className="font-mono text-xs text-gray-400">{maskToken(p.api_token)}</span>,
    renderEdit: (row, set) => <input type="password" className={INPUT_SM} value={row.api_token} onChange={(e) => set((r) => ({ ...r, api_token: e.target.value }))} placeholder="APIトークン" />,
    renderAdd: (row, set) => <input type="password" className={INPUT_SM} value={row.api_token} onChange={(e) => set((r) => ({ ...r, api_token: e.target.value }))} placeholder="APIトークン" />,
  },
];

const DIFY_COLUMNS: ColumnDef<DifyProfile, DifyEditRow>[] = [
  {
    header: "名前",
    renderView: (p) => <span className="font-medium">{p.name}</span>,
    renderEdit: (row, set) => <input type="text" className={INPUT_SM} value={row.name} onChange={(e) => set((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" />,
    renderAdd: (row, set) => <input type="text" className={INPUT_SM} value={row.name} onChange={(e) => set((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" autoFocus />,
  },
  {
    header: "API URL",
    renderView: (p) => <span className="text-xs text-gray-500">{p.base_url || "-"}</span>,
    renderEdit: (row, set) => <input type="text" className={INPUT_SM} value={row.base_url} onChange={(e) => set((r) => ({ ...r, base_url: e.target.value }))} placeholder="https://api.dify.ai/v1" />,
    renderAdd: (row, set) => <input type="text" className={INPUT_SM} value={row.base_url} onChange={(e) => set((r) => ({ ...r, base_url: e.target.value }))} placeholder="https://api.dify.ai/v1" />,
  },
  {
    header: "APIキー",
    renderView: (p) => <span className="font-mono text-xs text-gray-400">{maskToken(p.api_key)}</span>,
    renderEdit: (row, set) => <input type="password" className={INPUT_SM} value={row.api_key} onChange={(e) => set((r) => ({ ...r, api_key: e.target.value }))} placeholder="app-xxxxxxxx" />,
    renderAdd: (row, set) => <input type="password" className={INPUT_SM} value={row.api_key} onChange={(e) => set((r) => ({ ...r, api_key: e.target.value }))} placeholder="app-xxxxxxxx" />,
  },
  {
    header: "ユーザー",
    renderView: (p) => <span className="text-xs text-gray-400">{p.user || "-"}</span>,
    renderEdit: (row, set) => <input type="text" className={INPUT_SM} value={row.user} onChange={(e) => set((r) => ({ ...r, user: e.target.value }))} placeholder="user-001" />,
    renderAdd: (row, set) => <input type="text" className={INPUT_SM} value={row.user} onChange={(e) => set((r) => ({ ...r, user: e.target.value }))} placeholder="user-001" />,
  },
];

const WFA_COLUMNS: ColumnDef<WorkatoFileApiProfile, WorkatoFileApiEditRow>[] = [
  {
    header: "名前",
    renderView: (p) => <span className="font-medium">{p.name}</span>,
    renderEdit: (row, set) => <input type="text" className={INPUT_SM} value={row.name} onChange={(e) => set((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" />,
    renderAdd: (row, set) => <input type="text" className={INPUT_SM} value={row.name} onChange={(e) => set((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" autoFocus />,
  },
  {
    header: "API URL",
    renderView: (p) => <span className="text-xs text-gray-500">{p.url || "-"}</span>,
    renderEdit: (row, set) => <input type="text" className={INPUT_SM} value={row.url} onChange={(e) => set((r) => ({ ...r, url: e.target.value }))} placeholder="https://apim.workato.com/..." />,
    renderAdd: (row, set) => <input type="text" className={INPUT_SM} value={row.url} onChange={(e) => set((r) => ({ ...r, url: e.target.value }))} placeholder="https://apim.workato.com/..." />,
  },
  {
    header: "APIトークン",
    renderView: (p) => <span className="font-mono text-xs text-gray-400">{maskToken(p.api_token)}</span>,
    renderEdit: (row, set) => <input type="password" className={INPUT_SM} value={row.api_token} onChange={(e) => set((r) => ({ ...r, api_token: e.target.value }))} placeholder="api-token" />,
    renderAdd: (row, set) => <input type="password" className={INPUT_SM} value={row.api_token} onChange={(e) => set((r) => ({ ...r, api_token: e.target.value }))} placeholder="api-token" />,
  },
];

const GEMINI_COLUMNS: ColumnDef<GeminiProfile, GeminiEditRow>[] = [
  {
    header: "名前",
    renderView: (p) => <span className="font-medium">{p.name}</span>,
    renderEdit: (row, set) => <input type="text" className={INPUT_SM} value={row.name} onChange={(e) => set((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" />,
    renderAdd: (row, set) => <input type="text" className={INPUT_SM} value={row.name} onChange={(e) => set((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" autoFocus />,
  },
  {
    header: "APIキー",
    renderView: (p) => <span className="font-mono text-xs text-gray-400">{maskToken(p.api_key)}</span>,
    renderEdit: (row, set) => <input type="password" className={INPUT_SM} value={row.api_key} onChange={(e) => set((r) => ({ ...r, api_key: e.target.value }))} placeholder="AIza..." />,
    renderAdd: (row, set) => <input type="password" className={INPUT_SM} value={row.api_key} onChange={(e) => set((r) => ({ ...r, api_key: e.target.value }))} placeholder="AIza..." />,
  },
  {
    header: "モデル",
    renderView: (p) => <span className="text-xs text-gray-500">{p.model || "gemini-2.5-flash"}</span>,
    renderEdit: (row, set) => <input type="text" className={INPUT_SM} value={row.model} onChange={(e) => set((r) => ({ ...r, model: e.target.value }))} placeholder="gemini-2.5-flash" />,
    renderAdd: (row, set) => <input type="text" className={INPUT_SM} value={row.model} onChange={(e) => set((r) => ({ ...r, model: e.target.value }))} placeholder="gemini-2.5-flash" />,
  },
];

// ---------- メインコンポーネント ----------

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("connections");

  // Developer モード
  const [isDev, setIsDev] = useState(() => localStorage.getItem("developer-mode") === "true");
  const [devPassword, setDevPassword] = useState("");
  const [devError, setDevError] = useState<string | null>(null);
  const [devAttempts, setDevAttempts] = useState(0);
  const [devModalOpen, setDevModalOpen] = useState(false);

  // ズーム設定
  const [zoomLevel, setZoomLevel] = useState(() => localStorage.getItem("app-zoom") || "100");

  const handleZoomChange = useCallback((value: string) => {
    setZoomLevel(value);
    localStorage.setItem("app-zoom", value);
    const factor = parseFloat(value) / 100;
    if (factor > 0) getCurrentWebviewWindow().setZoom(factor);
  }, []);

  const devLocked = devAttempts >= 3;

  const handleDevEnable = async () => {
    if (devLocked) return;
    const hash = await sha256(devPassword);
    if (hash === DEVELOPER_HASH) {
      localStorage.setItem("developer-mode", "true");
      setIsDev(true);
      window.dispatchEvent(new Event("developer-mode-changed"));
      setDevPassword("");
      setDevError(null);
      setDevAttempts(0);
    } else {
      const next = devAttempts + 1;
      setDevAttempts(next);
      setDevPassword("");
      if (next >= 3) {
        setDevError("3回連続で失敗しました。再起動するまで入力できません。");
      } else {
        setDevError(`パスワードが正しくありません。（${next}/3）`);
      }
    }
  };

  const handleDevDisable = () => {
    localStorage.removeItem("developer-mode");
    setIsDev(false);
    setDevError(null);
    window.dispatchEvent(new Event("developer-mode-changed"));
  };

  const handleDevToggle = () => {
    if (isDev) handleDevDisable();
    else { if (devLocked) return; setDevPassword(""); setDevError(null); setDevModalOpen(true); }
  };

  const {
    profiles, activeProfile, setActiveProfile, editingIdx, editRow, setEditRow,
    adding, newRow, setNewRow, startEdit, cancelEdit, commitEdit, deleteProfile, startAdding, cancelAdding, commitAdd,
    difyProfiles, activeDifyProfile, setActiveDifyProfile, difyEditingIdx, difyEditRow, setDifyEditRow,
    difyAdding, difyNewRow, setDifyNewRow, startDifyEdit, cancelDifyEdit, commitDifyEdit,
    deleteDifyProfile, startDifyAdding, cancelDifyAdding, commitDifyAdd,
    geminiProfiles, activeGeminiProfile, setActiveGeminiProfile, geminiEditingIdx, geminiEditRow, setGeminiEditRow,
    geminiAdding, geminiNewRow, setGeminiNewRow, startGeminiEdit, cancelGeminiEdit, commitGeminiEdit,
    deleteGeminiProfile, startGeminiAdding, cancelGeminiAdding, commitGeminiAdd,
    wfaProfiles, activeWfaProfile, setActiveWfaProfile, wfaEditingIdx, wfaEditRow, setWfaEditRow,
    wfaAdding, wfaNewRow, setWfaNewRow, startWfaEdit, cancelWfaEdit, commitWfaEdit,
    deleteWfaProfile, startWfaAdding, cancelWfaAdding, commitWfaAdd,
    proxyUrl, setProxyUrl, saving, saved, error, handleSave,
  } = useProfileEditor();

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

      {error && <AlertBanner severity="error" className="mb-5">{error}</AlertBanner>}

      {/* タブバー */}
      <div className="flex items-center gap-1 mb-4">
        {TAB_DEFS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-white"
                : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

        {/* === 接続設定タブ === */}
        {activeTab === "connections" && (
          <div className="p-5 space-y-5">

            {/* --- Workato --- */}
            <div className={CARD}>
              <SectionHeader icon={<Workflow size={14} className="text-orange-500" />} label="Workato" color="bg-orange-50/50" count={profiles.length} adding={adding} onAdd={startAdding} />
              <ProfileTable<Profile, EditRow>
                theme="orange"
                columns={WORKATO_COLUMNS}
                profiles={profiles}
                activeProfile={activeProfile}
                getProfileName={(p) => p.name}
                onSelectActive={setActiveProfile}
                editingIdx={editingIdx}
                editRow={editRow}
                setEditRow={setEditRow}
                getEditProxy={(r) => r.use_proxy}
                setEditProxy={(v) => setEditRow((r) => ({ ...r, use_proxy: v }))}
                getEditName={(r) => r.name}
                onStartEdit={startEdit}
                onCommitEdit={commitEdit}
                onCancelEdit={cancelEdit}
                adding={adding}
                newRow={newRow}
                setNewRow={setNewRow}
                getAddProxy={(r) => r.use_proxy}
                setAddProxy={(v) => setNewRow((r) => ({ ...r, use_proxy: v }))}
                onCommitAdd={commitAdd}
                onCancelAdd={cancelAdding}
                onDelete={deleteProfile}
                emptyMessage="プロファイルがありません。「追加」から追加してください。"
              />
            </div>

            {/* --- Dify --- */}
            <div className={CARD}>
              <SectionHeader icon={<Globe size={14} className="text-blue-500" />} label="Dify" color="bg-blue-50/50" count={difyProfiles.length} adding={difyAdding} onAdd={startDifyAdding} />
              <ProfileTable<DifyProfile, DifyEditRow>
                theme="blue"
                columns={DIFY_COLUMNS}
                profiles={difyProfiles}
                activeProfile={activeDifyProfile}
                getProfileName={(p) => p.name}
                onSelectActive={setActiveDifyProfile}
                editingIdx={difyEditingIdx}
                editRow={difyEditRow}
                setEditRow={setDifyEditRow}
                getEditProxy={(r) => r.use_proxy}
                setEditProxy={(v) => setDifyEditRow((r) => ({ ...r, use_proxy: v }))}
                getEditName={(r) => r.name}
                onStartEdit={startDifyEdit}
                onCommitEdit={commitDifyEdit}
                onCancelEdit={cancelDifyEdit}
                adding={difyAdding}
                newRow={difyNewRow}
                setNewRow={setDifyNewRow}
                getAddProxy={(r) => r.use_proxy}
                setAddProxy={(v) => setDifyNewRow((r) => ({ ...r, use_proxy: v }))}
                onCommitAdd={commitDifyAdd}
                onCancelAdd={cancelDifyAdding}
                onDelete={deleteDifyProfile}
                emptyMessage="Dify プロファイルがありません。「追加」から追加してください。"
              />
            </div>

            {/* --- Workato File API --- */}
            <div className={CARD}>
              <SectionHeader icon={<Upload size={14} className="text-indigo-500" />} label="Workato File API" color="bg-indigo-50/50" count={wfaProfiles.length} adding={wfaAdding} onAdd={startWfaAdding} />
              <ProfileTable<WorkatoFileApiProfile, WorkatoFileApiEditRow>
                theme="indigo"
                columns={WFA_COLUMNS}
                profiles={wfaProfiles}
                activeProfile={activeWfaProfile}
                getProfileName={(p) => p.name}
                onSelectActive={setActiveWfaProfile}
                editingIdx={wfaEditingIdx}
                editRow={wfaEditRow}
                setEditRow={setWfaEditRow}
                getEditProxy={(r) => r.use_proxy}
                setEditProxy={(v) => setWfaEditRow((r) => ({ ...r, use_proxy: v }))}
                getEditName={(r) => r.name}
                onStartEdit={startWfaEdit}
                onCommitEdit={commitWfaEdit}
                onCancelEdit={cancelWfaEdit}
                adding={wfaAdding}
                newRow={wfaNewRow}
                setNewRow={setWfaNewRow}
                getAddProxy={(r) => r.use_proxy}
                setAddProxy={(v) => setWfaNewRow((r) => ({ ...r, use_proxy: v }))}
                onCommitAdd={commitWfaAdd}
                onCancelAdd={cancelWfaAdding}
                onDelete={deleteWfaProfile}
                emptyMessage="Workato File API プロファイルがありません。「追加」から追加してください。"
              />
            </div>

            {/* --- Gemini --- */}
            <div className={CARD}>
              <SectionHeader icon={<Sparkles size={14} className="text-purple-500" />} label="Gemini" color="bg-purple-50/50" count={geminiProfiles.length} adding={geminiAdding} onAdd={startGeminiAdding} />
              <ProfileTable<GeminiProfile, GeminiEditRow>
                theme="purple"
                columns={GEMINI_COLUMNS}
                profiles={geminiProfiles}
                activeProfile={activeGeminiProfile}
                getProfileName={(p) => p.name}
                onSelectActive={setActiveGeminiProfile}
                editingIdx={geminiEditingIdx}
                editRow={geminiEditRow}
                setEditRow={setGeminiEditRow}
                getEditProxy={(r) => r.use_proxy}
                setEditProxy={(v) => setGeminiEditRow((r) => ({ ...r, use_proxy: v }))}
                getEditName={(r) => r.name}
                onStartEdit={startGeminiEdit}
                onCommitEdit={commitGeminiEdit}
                onCancelEdit={cancelGeminiEdit}
                adding={geminiAdding}
                newRow={geminiNewRow}
                setNewRow={setGeminiNewRow}
                getAddProxy={(r) => r.use_proxy}
                setAddProxy={(v) => setGeminiNewRow((r) => ({ ...r, use_proxy: v }))}
                onCommitAdd={commitGeminiAdd}
                onCancelAdd={cancelGeminiAdding}
                onDelete={deleteGeminiProfile}
                emptyMessage="Gemini プロファイルがありません。「追加」から追加してください。"
              />
            </div>
          </div>
        )}

      {/* === 共通設定タブ === */}
      {activeTab === "general" && (
        <div className={`${CARD} p-5 space-y-6`}>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">プロキシ URL</label>
              <input type="text" className={`${INPUT_SM} max-w-md`} value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} placeholder="http://proxy:8080" />
              <p className="mt-1.5 text-xs text-gray-400">Workato・Dify・Gemini 共通のHTTPプロキシ設定です。不要な場合は空欄にしてください。</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">画面の拡大率</label>
              <select className={`${SELECT_SM} max-w-[160px]`} value={zoomLevel} onChange={(e) => handleZoomChange(e.target.value)}>
                <option value="75">75%</option>
                <option value="80">80%</option>
                <option value="85">85%</option>
                <option value="90">90%</option>
                <option value="95">95%</option>
                <option value="100">100%</option>
                <option value="110">110%</option>
                <option value="120">120%</option>
                <option value="130">130%</option>
                <option value="150">150%</option>
              </select>
              <p className="mt-1.5 text-xs text-gray-400">アプリ全体の表示倍率を変更します。</p>
            </div>
            {isDev && (
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
            )}
          </div>
        )}

      {/* 開発者モードトグル */}
      <div className="fixed bottom-6 right-6 flex items-center gap-2">
        <Lock size={12} className="text-gray-400" />
        <span className="text-[11px] text-gray-400">{devLocked ? "ロック中" : "開発者モード"}</span>
        <button
          onClick={handleDevToggle}
          disabled={!isDev && devLocked}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${isDev ? "bg-green-500" : "bg-gray-300"}`}
          title="開発者モード"
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${isDev ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {/* 開発者モード パスワードモーダル */}
      <Modal open={devModalOpen} onClose={() => setDevModalOpen(false)} title="開発者モード" maxWidth="max-w-sm"
        footer={<>
          <button className={BTN_OUTLINED_SM} onClick={() => setDevModalOpen(false)}>キャンセル</button>
          <button className={BTN_PRIMARY} disabled={!devPassword || devLocked}
            onClick={async () => { await handleDevEnable(); if (!devLocked && localStorage.getItem("developer-mode") === "true") setDevModalOpen(false); }}>
            <Lock size={16} />有効化
          </button>
        </>}
      >
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">パスワード</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="password" className={`${INPUT_SM} pl-8`} value={devPassword} disabled={devLocked}
              onChange={(e) => { setDevPassword(e.target.value); if (!devLocked) setDevError(null); }}
              onKeyDown={async (e) => { if (e.key === "Enter" && devPassword && !devLocked) { await handleDevEnable(); if (localStorage.getItem("developer-mode") === "true") setDevModalOpen(false); } }}
              placeholder={devLocked ? "ロック中（再起動が必要です）" : "パスワードを入力"} autoFocus />
          </div>
          {devError && <p className="mt-2 text-xs text-red-500">{devError}</p>}
        </div>
      </Modal>
    </div>
  );
}
