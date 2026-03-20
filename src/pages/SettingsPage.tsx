// 設定ページ。接続設定（Workato / Dify / Gemini / Workato File API）と共通設定。

import { useState, useCallback, useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  Plus,
  Trash2,
  CheckCircle,
  Save,
  FolderOpen,
  Settings,
  Check,
  X,
  Pencil,
  Lock,
  Workflow,
  Globe,
  Sparkles,
  Plug,
  Upload,
} from "lucide-react";
import { useProfileEditor } from "../hooks/useProfileEditor";
import { getLogDir, getConfigDir, openFolder } from "../lib/tauri";
import { maskToken } from "../lib/format";
import AlertBanner from "../components/AlertBanner";
import Modal from "../components/Modal";
import {
  BTN_PRIMARY,
  BTN_OUTLINED_SM,
  CARD,
  PAGE,
  HEADER_ROW,
  TABLE,
  TD,
  TR_HOVER,
  INPUT_SM,
  SELECT_SM,
} from "../lib/tw";

// セクションカラーに合わせたテーブルヘッダー
const TH_ORANGE = "px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-orange-600 bg-orange-50/50 border-b border-orange-100";
const TH_BLUE = "px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-blue-600 bg-blue-50/50 border-b border-blue-100";
const TH_PURPLE = "px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-purple-600 bg-purple-50/50 border-b border-purple-100";
const TH_INDIGO = "px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-indigo-600 bg-indigo-50/50 border-b border-indigo-100";

const RADIO_WORKATO =
  "appearance-none w-4 h-4 rounded-full border-2 border-gray-300 checked:border-2 checked:border-orange-500 checked:bg-orange-500 checked:shadow-[inset_0_0_0_2px_white] cursor-pointer";
const RADIO_DIFY =
  "appearance-none w-4 h-4 rounded-full border-2 border-gray-300 checked:border-2 checked:border-blue-500 checked:bg-blue-500 checked:shadow-[inset_0_0_0_2px_white] cursor-pointer";
const RADIO_GEMINI =
  "appearance-none w-4 h-4 rounded-full border-2 border-gray-300 checked:border-2 checked:border-purple-500 checked:bg-purple-500 checked:shadow-[inset_0_0_0_2px_white] cursor-pointer";
const RADIO_INDIGO =
  "appearance-none w-4 h-4 rounded-full border-2 border-gray-300 checked:border-2 checked:border-indigo-500 checked:bg-indigo-500 checked:shadow-[inset_0_0_0_2px_white] cursor-pointer";

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

/** 共通のテーブル列幅（ラジオ・Proxy・操作列を統一） */
const COL_RADIO = 48;
const COL_PROXY = 72;
const COL_ACTIONS = 100;

/** セクションヘッダー */
function SectionHeader({ icon, label, color, count, adding, onAdd }: {
  icon: React.ReactNode; label: string; color: string; count: number; adding: boolean; onAdd: () => void;
}) {
  return (
    <div className={`flex items-center justify-between ${color} px-4 py-2.5 rounded-t-lg border-b border-gray-200`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold">{label}</span>
        <span className="rounded-full bg-gray-200 px-1.5 text-[10px] font-medium text-gray-500">{count}</span>
      </div>
      <button
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100/60 transition-colors"
        disabled={adding}
        onClick={onAdd}
      >
        <Plus size={14} />
        追加
      </button>
    </div>
  );
}

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
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH_ORANGE} style={{ width: COL_RADIO }} />
                    <th className={TH_ORANGE}>名前</th>
                    <th className={TH_ORANGE}>Base URL</th>
                    <th className={TH_ORANGE}>APIトークン</th>
                    <th className={TH_ORANGE} style={{ width: COL_PROXY }}>Proxy</th>
                    <th className={TH_ORANGE} style={{ width: COL_ACTIONS }} />
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p, idx) =>
                    editingIdx === idx ? (
                      <tr key={idx} className="group bg-orange-50/40">
                        <td className={TD}><input type="radio" className={RADIO_WORKATO} checked={activeProfile === editRow.name || activeProfile === p.name} onChange={() => setActiveProfile(editRow.name || p.name)} /></td>
                        <td className={TD}><input type="text" className={INPUT_SM} value={editRow.name} onChange={(e) => setEditRow((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" /></td>
                        <td className={TD}><input type="text" className={INPUT_SM} value={editRow.base_url} onChange={(e) => setEditRow((r) => ({ ...r, base_url: e.target.value }))} placeholder="https://app.trial.workato.com" /></td>
                        <td className={TD}><input type="password" className={INPUT_SM} value={editRow.api_token} onChange={(e) => setEditRow((r) => ({ ...r, api_token: e.target.value }))} placeholder="APIトークン" /></td>
                        <td className={`${TD} text-center`}>
                          <button
                            onClick={() => setEditRow((r) => ({ ...r, use_proxy: !r.use_proxy }))}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${editRow.use_proxy ? "bg-orange-500" : "bg-gray-300"}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${editRow.use_proxy ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                          </button>
                        </td>
                        <td className={TD}>
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50" onClick={commitEdit} title="保存"><Check size={16} /></button>
                            <button className="rounded p-1.5 text-red-400 hover:bg-red-50" onClick={cancelEdit} title="キャンセル"><X size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={idx} className={`group ${TR_HOVER} ${activeProfile === p.name ? "bg-orange-50/40" : ""}`}>
                        <td className={TD}><input type="radio" className={RADIO_WORKATO} checked={activeProfile === p.name} onChange={() => setActiveProfile(p.name)} /></td>
                        <td className={`${TD} font-medium`}>{p.name}</td>
                        <td className={`${TD} text-xs text-gray-500`}>{p.base_url}</td>
                        <td className={`${TD} font-mono text-xs text-gray-400`}>{maskToken(p.api_token)}</td>
                        <td className={`${TD} text-center`}><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.use_proxy ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-400"}`}>{p.use_proxy ? "ON" : "OFF"}</span></td>
                        <td className={TD}>
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="rounded p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100" onClick={() => startEdit(idx)} title="編集"><Pencil size={14} /></button>
                            <button className="rounded p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteProfile(idx)} title="削除"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                  {adding && (
                    <tr className="group bg-blue-50/40">
                      <td className={TD}><input type="radio" className={RADIO_WORKATO} disabled /></td>
                      <td className={TD}><input type="text" className={INPUT_SM} value={newRow.name} onChange={(e) => setNewRow((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" autoFocus /></td>
                      <td className={TD}><input type="text" className={INPUT_SM} value={newRow.base_url} onChange={(e) => setNewRow((r) => ({ ...r, base_url: e.target.value }))} placeholder="https://app.trial.workato.com" /></td>
                      <td className={TD}><input type="password" className={INPUT_SM} value={newRow.api_token} onChange={(e) => setNewRow((r) => ({ ...r, api_token: e.target.value }))} placeholder="APIトークン" /></td>
                      <td className={`${TD} text-center`}>
                        <button
                          onClick={() => setNewRow((r) => ({ ...r, use_proxy: !r.use_proxy }))}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${newRow.use_proxy ? "bg-orange-500" : "bg-gray-300"}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${newRow.use_proxy ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                        </button>
                      </td>
                      <td className={TD}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50" onClick={commitAdd} title="追加"><Check size={16} /></button>
                          <button className="rounded p-1.5 text-red-400 hover:bg-red-50" onClick={cancelAdding} title="キャンセル"><X size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {profiles.length === 0 && !adding && (
                    <tr><td className={`${TD} text-center text-xs text-gray-400`} colSpan={6}>プロファイルがありません。「追加」から追加してください。</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* --- Dify --- */}
            <div className={CARD}>
              <SectionHeader icon={<Globe size={14} className="text-blue-500" />} label="Dify" color="bg-blue-50/50" count={difyProfiles.length} adding={difyAdding} onAdd={startDifyAdding} />
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH_BLUE} style={{ width: COL_RADIO }} />
                    <th className={TH_BLUE}>名前</th>
                    <th className={TH_BLUE}>API URL</th>
                    <th className={TH_BLUE}>APIキー</th>
                    <th className={TH_BLUE}>ユーザー</th>
                    <th className={TH_BLUE} style={{ width: COL_PROXY }}>Proxy</th>
                    <th className={TH_BLUE} style={{ width: COL_ACTIONS }} />
                  </tr>
                </thead>
                <tbody>
                  {difyProfiles.map((p, idx) =>
                    difyEditingIdx === idx ? (
                      <tr key={idx} className="group bg-blue-50/40">
                        <td className={TD}><input type="radio" className={RADIO_DIFY} checked={activeDifyProfile === difyEditRow.name || activeDifyProfile === p.name} onChange={() => setActiveDifyProfile(difyEditRow.name || p.name)} /></td>
                        <td className={TD}><input type="text" className={INPUT_SM} value={difyEditRow.name} onChange={(e) => setDifyEditRow((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" /></td>
                        <td className={TD}><input type="text" className={INPUT_SM} value={difyEditRow.base_url} onChange={(e) => setDifyEditRow((r) => ({ ...r, base_url: e.target.value }))} placeholder="https://api.dify.ai/v1" /></td>
                        <td className={TD}><input type="password" className={INPUT_SM} value={difyEditRow.api_key} onChange={(e) => setDifyEditRow((r) => ({ ...r, api_key: e.target.value }))} placeholder="app-xxxxxxxx" /></td>
                        <td className={TD}><input type="text" className={INPUT_SM} value={difyEditRow.user} onChange={(e) => setDifyEditRow((r) => ({ ...r, user: e.target.value }))} placeholder="user-001" /></td>
                        <td className={`${TD} text-center`}>
                          <button
                            onClick={() => setDifyEditRow((r) => ({ ...r, use_proxy: !r.use_proxy }))}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${difyEditRow.use_proxy ? "bg-blue-500" : "bg-gray-300"}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${difyEditRow.use_proxy ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                          </button>
                        </td>
                        <td className={TD}>
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50" onClick={commitDifyEdit} title="保存"><Check size={16} /></button>
                            <button className="rounded p-1.5 text-red-400 hover:bg-red-50" onClick={cancelDifyEdit} title="キャンセル"><X size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={idx} className={`group ${TR_HOVER} ${activeDifyProfile === p.name ? "bg-blue-50/40" : ""}`}>
                        <td className={TD}><input type="radio" className={RADIO_DIFY} checked={activeDifyProfile === p.name} onChange={() => setActiveDifyProfile(p.name)} /></td>
                        <td className={`${TD} font-medium`}>{p.name}</td>
                        <td className={`${TD} text-xs text-gray-500`}>{p.base_url || "-"}</td>
                        <td className={`${TD} font-mono text-xs text-gray-400`}>{maskToken(p.api_key)}</td>
                        <td className={`${TD} text-xs text-gray-400`}>{p.user || "-"}</td>
                        <td className={`${TD} text-center`}><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.use_proxy ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"}`}>{p.use_proxy ? "ON" : "OFF"}</span></td>
                        <td className={TD}>
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="rounded p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100" onClick={() => startDifyEdit(idx)} title="編集"><Pencil size={14} /></button>
                            <button className="rounded p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteDifyProfile(idx)} title="削除"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                  {difyAdding && (
                    <tr className="group bg-blue-50/40">
                      <td className={TD}><input type="radio" className={RADIO_DIFY} disabled /></td>
                      <td className={TD}><input type="text" className={INPUT_SM} value={difyNewRow.name} onChange={(e) => setDifyNewRow((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" autoFocus /></td>
                      <td className={TD}><input type="text" className={INPUT_SM} value={difyNewRow.base_url} onChange={(e) => setDifyNewRow((r) => ({ ...r, base_url: e.target.value }))} placeholder="https://api.dify.ai/v1" /></td>
                      <td className={TD}><input type="password" className={INPUT_SM} value={difyNewRow.api_key} onChange={(e) => setDifyNewRow((r) => ({ ...r, api_key: e.target.value }))} placeholder="app-xxxxxxxx" /></td>
                      <td className={TD}><input type="text" className={INPUT_SM} value={difyNewRow.user} onChange={(e) => setDifyNewRow((r) => ({ ...r, user: e.target.value }))} placeholder="user-001" /></td>
                      <td className={`${TD} text-center`}>
                        <button
                          onClick={() => setDifyNewRow((r) => ({ ...r, use_proxy: !r.use_proxy }))}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${difyNewRow.use_proxy ? "bg-blue-500" : "bg-gray-300"}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${difyNewRow.use_proxy ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                        </button>
                      </td>
                      <td className={TD}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50" onClick={commitDifyAdd} title="追加"><Check size={16} /></button>
                          <button className="rounded p-1.5 text-red-400 hover:bg-red-50" onClick={cancelDifyAdding} title="キャンセル"><X size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {difyProfiles.length === 0 && !difyAdding && (
                    <tr><td className={`${TD} text-center text-xs text-gray-400`} colSpan={7}>Dify プロファイルがありません。「追加」から追加してください。</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* --- Workato File API --- */}
            <div className={CARD}>
              <SectionHeader icon={<Upload size={14} className="text-indigo-500" />} label="Workato File API" color="bg-indigo-50/50" count={wfaProfiles.length} adding={wfaAdding} onAdd={startWfaAdding} />
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH_INDIGO} style={{ width: COL_RADIO }} />
                    <th className={TH_INDIGO}>名前</th>
                    <th className={TH_INDIGO}>API URL</th>
                    <th className={TH_INDIGO}>APIトークン</th>
                    <th className={TH_INDIGO} style={{ width: COL_PROXY }}>Proxy</th>
                    <th className={TH_INDIGO} style={{ width: COL_ACTIONS }} />
                  </tr>
                </thead>
                <tbody>
                  {wfaProfiles.map((p, idx) =>
                    wfaEditingIdx === idx ? (
                      <tr key={idx} className="group bg-indigo-50/40">
                        <td className={TD}><input type="radio" className={RADIO_INDIGO} checked={activeWfaProfile === wfaEditRow.name || activeWfaProfile === p.name} onChange={() => setActiveWfaProfile(wfaEditRow.name || p.name)} /></td>
                        <td className={TD}><input type="text" className={INPUT_SM} value={wfaEditRow.name} onChange={(e) => setWfaEditRow((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" /></td>
                        <td className={TD}><input type="text" className={INPUT_SM} value={wfaEditRow.url} onChange={(e) => setWfaEditRow((r) => ({ ...r, url: e.target.value }))} placeholder="https://apim.workato.com/..." /></td>
                        <td className={TD}><input type="password" className={INPUT_SM} value={wfaEditRow.api_token} onChange={(e) => setWfaEditRow((r) => ({ ...r, api_token: e.target.value }))} placeholder="api-token" /></td>
                        <td className={`${TD} text-center`}>
                          <button
                            onClick={() => setWfaEditRow((r) => ({ ...r, use_proxy: !r.use_proxy }))}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${wfaEditRow.use_proxy ? "bg-indigo-500" : "bg-gray-300"}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${wfaEditRow.use_proxy ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                          </button>
                        </td>
                        <td className={TD}>
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50" onClick={commitWfaEdit} title="保存"><Check size={16} /></button>
                            <button className="rounded p-1.5 text-red-400 hover:bg-red-50" onClick={cancelWfaEdit} title="キャンセル"><X size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={idx} className={`group ${TR_HOVER} ${activeWfaProfile === p.name ? "bg-indigo-50/40" : ""}`}>
                        <td className={TD}><input type="radio" className={RADIO_INDIGO} checked={activeWfaProfile === p.name} onChange={() => setActiveWfaProfile(p.name)} /></td>
                        <td className={`${TD} font-medium`}>{p.name}</td>
                        <td className={`${TD} text-xs text-gray-500`}>{p.url || "-"}</td>
                        <td className={`${TD} font-mono text-xs text-gray-400`}>{maskToken(p.api_token)}</td>
                        <td className={`${TD} text-center`}><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.use_proxy ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400"}`}>{p.use_proxy ? "ON" : "OFF"}</span></td>
                        <td className={TD}>
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="rounded p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100" onClick={() => startWfaEdit(idx)} title="編集"><Pencil size={14} /></button>
                            <button className="rounded p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteWfaProfile(idx)} title="削除"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                  {wfaAdding && (
                    <tr className="group bg-indigo-50/40">
                      <td className={TD}><input type="radio" className={RADIO_INDIGO} disabled /></td>
                      <td className={TD}><input type="text" className={INPUT_SM} value={wfaNewRow.name} onChange={(e) => setWfaNewRow((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" autoFocus /></td>
                      <td className={TD}><input type="text" className={INPUT_SM} value={wfaNewRow.url} onChange={(e) => setWfaNewRow((r) => ({ ...r, url: e.target.value }))} placeholder="https://apim.workato.com/..." /></td>
                      <td className={TD}><input type="password" className={INPUT_SM} value={wfaNewRow.api_token} onChange={(e) => setWfaNewRow((r) => ({ ...r, api_token: e.target.value }))} placeholder="api-token" /></td>
                      <td className={`${TD} text-center`}>
                        <button
                          onClick={() => setWfaNewRow((r) => ({ ...r, use_proxy: !r.use_proxy }))}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${wfaNewRow.use_proxy ? "bg-indigo-500" : "bg-gray-300"}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${wfaNewRow.use_proxy ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                        </button>
                      </td>
                      <td className={TD}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50" onClick={commitWfaAdd} title="追加"><Check size={16} /></button>
                          <button className="rounded p-1.5 text-red-400 hover:bg-red-50" onClick={cancelWfaAdding} title="キャンセル"><X size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {wfaProfiles.length === 0 && !wfaAdding && (
                    <tr><td className={`${TD} text-center text-xs text-gray-400`} colSpan={6}>Workato File API プロファイルがありません。「追加」から追加してください。</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* --- Gemini --- */}
            <div className={CARD}>
              <SectionHeader icon={<Sparkles size={14} className="text-purple-500" />} label="Gemini" color="bg-purple-50/50" count={geminiProfiles.length} adding={geminiAdding} onAdd={startGeminiAdding} />
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH_PURPLE} style={{ width: COL_RADIO }} />
                    <th className={TH_PURPLE}>名前</th>
                    <th className={TH_PURPLE}>APIキー</th>
                    <th className={TH_PURPLE}>モデル</th>
                    <th className={TH_PURPLE} style={{ width: COL_PROXY }}>Proxy</th>
                    <th className={TH_PURPLE} style={{ width: COL_ACTIONS }} />
                  </tr>
                </thead>
                <tbody>
                  {geminiProfiles.map((p, idx) =>
                    geminiEditingIdx === idx ? (
                      <tr key={idx} className="group bg-purple-50/40">
                        <td className={TD}><input type="radio" className={RADIO_GEMINI} checked={activeGeminiProfile === geminiEditRow.name || activeGeminiProfile === p.name} onChange={() => setActiveGeminiProfile(geminiEditRow.name || p.name)} /></td>
                        <td className={TD}><input type="text" className={INPUT_SM} value={geminiEditRow.name} onChange={(e) => setGeminiEditRow((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" /></td>
                        <td className={TD}><input type="password" className={INPUT_SM} value={geminiEditRow.api_key} onChange={(e) => setGeminiEditRow((r) => ({ ...r, api_key: e.target.value }))} placeholder="AIza..." /></td>
                        <td className={TD}><input type="text" className={INPUT_SM} value={geminiEditRow.model} onChange={(e) => setGeminiEditRow((r) => ({ ...r, model: e.target.value }))} placeholder="gemini-2.5-flash" /></td>
                        <td className={`${TD} text-center`}>
                          <button
                            onClick={() => setGeminiEditRow((r) => ({ ...r, use_proxy: !r.use_proxy }))}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${geminiEditRow.use_proxy ? "bg-purple-500" : "bg-gray-300"}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${geminiEditRow.use_proxy ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                          </button>
                        </td>
                        <td className={TD}>
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50" onClick={commitGeminiEdit} title="保存"><Check size={16} /></button>
                            <button className="rounded p-1.5 text-red-400 hover:bg-red-50" onClick={cancelGeminiEdit} title="キャンセル"><X size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={idx} className={`group ${TR_HOVER} ${activeGeminiProfile === p.name ? "bg-purple-50/40" : ""}`}>
                        <td className={TD}><input type="radio" className={RADIO_GEMINI} checked={activeGeminiProfile === p.name} onChange={() => setActiveGeminiProfile(p.name)} /></td>
                        <td className={`${TD} font-medium`}>{p.name}</td>
                        <td className={`${TD} font-mono text-xs text-gray-400`}>{maskToken(p.api_key)}</td>
                        <td className={`${TD} text-xs text-gray-500`}>{p.model || "gemini-2.5-flash"}</td>
                        <td className={`${TD} text-center`}><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.use_proxy ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-400"}`}>{p.use_proxy ? "ON" : "OFF"}</span></td>
                        <td className={TD}>
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="rounded p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100" onClick={() => startGeminiEdit(idx)} title="編集"><Pencil size={14} /></button>
                            <button className="rounded p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteGeminiProfile(idx)} title="削除"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                  {geminiAdding && (
                    <tr className="group bg-purple-50/40">
                      <td className={TD}><input type="radio" className={RADIO_GEMINI} disabled /></td>
                      <td className={TD}><input type="text" className={INPUT_SM} value={geminiNewRow.name} onChange={(e) => setGeminiNewRow((r) => ({ ...r, name: e.target.value }))} placeholder="プロファイル名" autoFocus /></td>
                      <td className={TD}><input type="password" className={INPUT_SM} value={geminiNewRow.api_key} onChange={(e) => setGeminiNewRow((r) => ({ ...r, api_key: e.target.value }))} placeholder="AIza..." /></td>
                      <td className={TD}><input type="text" className={INPUT_SM} value={geminiNewRow.model} onChange={(e) => setGeminiNewRow((r) => ({ ...r, model: e.target.value }))} placeholder="gemini-2.5-flash" /></td>
                      <td className={`${TD} text-center`}>
                        <button
                          onClick={() => setGeminiNewRow((r) => ({ ...r, use_proxy: !r.use_proxy }))}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${geminiNewRow.use_proxy ? "bg-purple-500" : "bg-gray-300"}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${geminiNewRow.use_proxy ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                        </button>
                      </td>
                      <td className={TD}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50" onClick={commitGeminiAdd} title="追加"><Check size={16} /></button>
                          <button className="rounded p-1.5 text-red-400 hover:bg-red-50" onClick={cancelGeminiAdding} title="キャンセル"><X size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {geminiProfiles.length === 0 && !geminiAdding && (
                    <tr><td className={`${TD} text-center text-xs text-gray-400`} colSpan={6}>Gemini プロファイルがありません。「追加」から追加してください。</td></tr>
                  )}
                </tbody>
              </table>
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
