// 設定ページ。Workato / Dify プロファイルの追加・編集・削除・保存。

import { useState, useCallback } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  Plus,
  Trash2,
  CheckCircle,
  Save,
  Star,
  FolderOpen,
  Settings,
  Check,
  X,
  Pencil,
  Lock,
  Workflow,
  Globe,
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
  TH,
  TD,
  TR_HOVER,
  INPUT_SM,
  SELECT_SM,
} from "../lib/tw";

// カスタムラジオボタン（appearance-none で色はみ出し防止）
const RADIO_WORKATO =
  "appearance-none w-4 h-4 rounded-full border-2 border-gray-300 checked:border-orange-500 checked:bg-orange-500 checked:border-4 cursor-pointer";
const RADIO_DIFY =
  "appearance-none w-4 h-4 rounded-full border-2 border-gray-300 checked:border-blue-500 checked:bg-blue-500 checked:border-4 cursor-pointer";

const DEVELOPER_HASH = "524beeec873cb78924f03e60f2b9a7313873df5881f0654eaead2d581336e643";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type SettingsTab = "workato" | "dify" | "general";

const TAB_DEFS: { id: SettingsTab; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
  { id: "workato", label: "Workato", icon: <Workflow size={15} />, color: "text-gray-500", activeColor: "border-orange-500 text-orange-600" },
  { id: "dify",    label: "Dify",    icon: <Globe size={15} />,    color: "text-gray-500", activeColor: "border-blue-500 text-blue-600" },
  { id: "general", label: "共通設定", icon: <Settings size={15} />, color: "text-gray-500", activeColor: "border-gray-600 text-gray-700" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("workato");

  // Developer モード
  const [isDev, setIsDev] = useState(
    () => localStorage.getItem("developer-mode") === "true",
  );
  const [devPassword, setDevPassword] = useState("");
  const [devError, setDevError] = useState<string | null>(null);
  const [devAttempts, setDevAttempts] = useState(0);
  const [devModalOpen, setDevModalOpen] = useState(false);

  // ズーム設定
  const [zoomLevel, setZoomLevel] = useState(
    () => localStorage.getItem("app-zoom") || "100",
  );

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
    if (isDev) {
      handleDevDisable();
    } else {
      if (devLocked) return;
      setDevPassword("");
      setDevError(null);
      setDevModalOpen(true);
    }
  };

  const {
    // Workato
    profiles,
    activeProfile,
    setActiveProfile,
    editingIdx,
    editRow,
    setEditRow,
    adding,
    newRow,
    setNewRow,
    startEdit,
    cancelEdit,
    commitEdit,
    deleteProfile,
    startAdding,
    cancelAdding,
    commitAdd,
    // Dify
    difyProfiles,
    activeDifyProfile,
    setActiveDifyProfile,
    difyEditingIdx,
    difyEditRow,
    setDifyEditRow,
    difyAdding,
    difyNewRow,
    setDifyNewRow,
    startDifyEdit,
    cancelDifyEdit,
    commitDifyEdit,
    deleteDifyProfile,
    startDifyAdding,
    cancelDifyAdding,
    commitDifyAdd,
    // 共通
    proxyUrl,
    setProxyUrl,
    saving,
    saved,
    error,
    handleSave,
  } = useProfileEditor();

  return (
    <div className={PAGE}>
      {/* ヘッダー + 保存ボタン */}
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-200 text-gray-500">
            <Settings size={20} />
          </span>
          <h1 className="text-xl font-bold text-gray-600">Settings</h1>
        </div>
        <button className={BTN_PRIMARY} disabled={saving} onClick={handleSave}>
          {saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saved ? "保存しました" : saving ? "保存中..." : "保存"}
        </button>
      </div>

      {error && (
        <AlertBanner severity="error" className="mb-5">
          {error}
        </AlertBanner>
      )}

      {/* タブ付きカード */}
      <div className={`${CARD} mb-5`}>
        {/* タブバー */}
        <div className="flex items-center border-b border-gray-200 px-2">
          {TAB_DEFS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? tab.activeColor
                  : `border-transparent ${tab.color} hover:text-gray-700 hover:border-gray-300`
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* === Workato タブ === */}
        {activeTab === "workato" && (
          <div>
            <div className="flex items-center justify-between bg-orange-50/50 px-4 py-2.5">
              <span className="text-xs font-medium text-orange-600">API プロファイル</span>
              <button
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-100/60 transition-colors"
                disabled={adding}
                onClick={startAdding}
              >
                <Plus size={14} />
                追加
              </button>
            </div>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH} style={{ width: 48 }} />
                  <th className={TH}>名前</th>
                  <th className={TH}>Base URL</th>
                  <th className={TH}>APIトークン</th>
                  <th className={TH} style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {profiles.map((p, idx) =>
                  editingIdx === idx ? (
                    <tr key={idx} className="group bg-orange-50/40">
                      <td className={TD}>
                        <input
                          type="radio"
                          className={RADIO_WORKATO}
                          checked={
                            activeProfile === editRow.name ||
                            activeProfile === p.name
                          }
                          onChange={() => setActiveProfile(editRow.name || p.name)}
                        />
                      </td>
                      <td className={TD}>
                        <input
                          type="text"
                          className={INPUT_SM}
                          value={editRow.name}
                          onChange={(e) =>
                            setEditRow((r) => ({ ...r, name: e.target.value }))
                          }
                          placeholder="プロファイル名"
                        />
                      </td>
                      <td className={TD}>
                        <input
                          type="text"
                          className={INPUT_SM}
                          value={editRow.base_url}
                          onChange={(e) =>
                            setEditRow((r) => ({ ...r, base_url: e.target.value }))
                          }
                          placeholder="https://app.trial.workato.com"
                        />
                      </td>
                      <td className={TD}>
                        <input
                          type="password"
                          className={INPUT_SM}
                          value={editRow.api_token}
                          onChange={(e) =>
                            setEditRow((r) => ({ ...r, api_token: e.target.value }))
                          }
                          placeholder="APIトークン"
                        />
                      </td>
                      <td className={TD}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50"
                            onClick={commitEdit}
                            title="保存"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            className="rounded p-1.5 text-red-400 hover:bg-red-50"
                            onClick={cancelEdit}
                            title="キャンセル"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={idx}
                      className={`group ${TR_HOVER} ${activeProfile === p.name ? "bg-orange-50/40" : ""}`}
                    >
                      <td className={TD}>
                        <input
                          type="radio"
                          className={RADIO_WORKATO}
                          checked={activeProfile === p.name}
                          onChange={() => setActiveProfile(p.name)}
                        />
                      </td>
                      <td className={`${TD} font-medium`}>
                        <span className="flex items-center gap-1.5">
                          {activeProfile === p.name && (
                            <Star
                              size={14}
                              style={{ color: "#f97316", fill: "#f97316" }}
                            />
                          )}
                          {p.name}
                        </span>
                      </td>
                      <td className={`${TD} text-xs text-gray-500`}>
                        {p.base_url}
                      </td>
                      <td className={`${TD} font-mono text-xs text-gray-400`}>
                        {maskToken(p.api_token)}
                      </td>
                      <td className={TD}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="rounded p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            onClick={() => startEdit(idx)}
                            title="編集"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="rounded p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => deleteProfile(idx)}
                            title="削除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}

                {adding && (
                  <tr className="group bg-blue-50/40">
                    <td className={TD}>
                      <input type="radio" className={RADIO_WORKATO} disabled />
                    </td>
                    <td className={TD}>
                      <input
                        type="text"
                        className={INPUT_SM}
                        value={newRow.name}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, name: e.target.value }))
                        }
                        placeholder="プロファイル名"
                        autoFocus
                      />
                    </td>
                    <td className={TD}>
                      <input
                        type="text"
                        className={INPUT_SM}
                        value={newRow.base_url}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, base_url: e.target.value }))
                        }
                        placeholder="https://app.trial.workato.com"
                      />
                    </td>
                    <td className={TD}>
                      <input
                        type="password"
                        className={INPUT_SM}
                        value={newRow.api_token}
                        onChange={(e) =>
                          setNewRow((r) => ({ ...r, api_token: e.target.value }))
                        }
                        placeholder="APIトークン"
                      />
                    </td>
                    <td className={TD}>
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50"
                          onClick={commitAdd}
                          title="追加"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          className="rounded p-1.5 text-red-400 hover:bg-red-50"
                          onClick={cancelAdding}
                          title="キャンセル"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {profiles.length === 0 && !adding && (
                  <tr>
                    <td className={`${TD} text-center text-xs text-gray-400`} colSpan={5}>
                      プロファイルがありません。「追加」から追加してください。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* === Dify タブ === */}
        {activeTab === "dify" && (
          <div>
            <div className="flex items-center justify-between bg-blue-50/50 px-4 py-2.5">
              <span className="text-xs font-medium text-blue-600">API プロファイル</span>
              <button
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100/60 transition-colors"
                disabled={difyAdding}
                onClick={startDifyAdding}
              >
                <Plus size={14} />
                追加
              </button>
            </div>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH} style={{ width: 48 }} />
                  <th className={TH}>名前</th>
                  <th className={TH}>API URL</th>
                  <th className={TH}>APIキー</th>
                  <th className={TH}>ユーザー</th>
                  <th className={TH} style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {difyProfiles.map((p, idx) =>
                  difyEditingIdx === idx ? (
                    <tr key={idx} className="group bg-blue-50/40">
                      <td className={TD}>
                        <input
                          type="radio"
                          className={RADIO_DIFY}
                          checked={
                            activeDifyProfile === difyEditRow.name ||
                            activeDifyProfile === p.name
                          }
                          onChange={() =>
                            setActiveDifyProfile(difyEditRow.name || p.name)
                          }
                        />
                      </td>
                      <td className={TD}>
                        <input
                          type="text"
                          className={INPUT_SM}
                          value={difyEditRow.name}
                          onChange={(e) =>
                            setDifyEditRow((r) => ({ ...r, name: e.target.value }))
                          }
                          placeholder="プロファイル名"
                        />
                      </td>
                      <td className={TD}>
                        <input
                          type="text"
                          className={INPUT_SM}
                          value={difyEditRow.base_url}
                          onChange={(e) =>
                            setDifyEditRow((r) => ({
                              ...r,
                              base_url: e.target.value,
                            }))
                          }
                          placeholder="https://api.dify.ai/v1"
                        />
                      </td>
                      <td className={TD}>
                        <input
                          type="password"
                          className={INPUT_SM}
                          value={difyEditRow.api_key}
                          onChange={(e) =>
                            setDifyEditRow((r) => ({
                              ...r,
                              api_key: e.target.value,
                            }))
                          }
                          placeholder="app-xxxxxxxx"
                        />
                      </td>
                      <td className={TD}>
                        <input
                          type="text"
                          className={INPUT_SM}
                          value={difyEditRow.user}
                          onChange={(e) =>
                            setDifyEditRow((r) => ({ ...r, user: e.target.value }))
                          }
                          placeholder="user-001"
                        />
                      </td>
                      <td className={TD}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50"
                            onClick={commitDifyEdit}
                            title="保存"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            className="rounded p-1.5 text-red-400 hover:bg-red-50"
                            onClick={cancelDifyEdit}
                            title="キャンセル"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={idx}
                      className={`group ${TR_HOVER} ${activeDifyProfile === p.name ? "bg-blue-50/40" : ""}`}
                    >
                      <td className={TD}>
                        <input
                          type="radio"
                          className={RADIO_DIFY}
                          checked={activeDifyProfile === p.name}
                          onChange={() => setActiveDifyProfile(p.name)}
                        />
                      </td>
                      <td className={`${TD} font-medium`}>
                        <span className="flex items-center gap-1.5">
                          {activeDifyProfile === p.name && (
                            <Star
                              size={14}
                              style={{ color: "#3b82f6", fill: "#3b82f6" }}
                            />
                          )}
                          {p.name}
                        </span>
                      </td>
                      <td className={`${TD} text-xs text-gray-500`}>
                        {p.base_url || "-"}
                      </td>
                      <td className={`${TD} font-mono text-xs text-gray-400`}>
                        {maskToken(p.api_key)}
                      </td>
                      <td className={`${TD} text-xs text-gray-400`}>
                        {p.user || "-"}
                      </td>
                      <td className={TD}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="rounded p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            onClick={() => startDifyEdit(idx)}
                            title="編集"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="rounded p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => deleteDifyProfile(idx)}
                            title="削除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}

                {difyAdding && (
                  <tr className="group bg-blue-50/40">
                    <td className={TD}>
                      <input type="radio" className={RADIO_DIFY} disabled />
                    </td>
                    <td className={TD}>
                      <input
                        type="text"
                        className={INPUT_SM}
                        value={difyNewRow.name}
                        onChange={(e) =>
                          setDifyNewRow((r) => ({ ...r, name: e.target.value }))
                        }
                        placeholder="プロファイル名"
                        autoFocus
                      />
                    </td>
                    <td className={TD}>
                      <input
                        type="text"
                        className={INPUT_SM}
                        value={difyNewRow.base_url}
                        onChange={(e) =>
                          setDifyNewRow((r) => ({ ...r, base_url: e.target.value }))
                        }
                        placeholder="https://api.dify.ai/v1"
                      />
                    </td>
                    <td className={TD}>
                      <input
                        type="password"
                        className={INPUT_SM}
                        value={difyNewRow.api_key}
                        onChange={(e) =>
                          setDifyNewRow((r) => ({ ...r, api_key: e.target.value }))
                        }
                        placeholder="app-xxxxxxxx"
                      />
                    </td>
                    <td className={TD}>
                      <input
                        type="text"
                        className={INPUT_SM}
                        value={difyNewRow.user}
                        onChange={(e) =>
                          setDifyNewRow((r) => ({ ...r, user: e.target.value }))
                        }
                        placeholder="user-001"
                      />
                    </td>
                    <td className={TD}>
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50"
                          onClick={commitDifyAdd}
                          title="追加"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          className="rounded p-1.5 text-red-400 hover:bg-red-50"
                          onClick={cancelDifyAdding}
                          title="キャンセル"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {difyProfiles.length === 0 && !difyAdding && (
                  <tr>
                    <td
                      className={`${TD} text-center text-xs text-gray-400`}
                      colSpan={6}
                    >
                      Dify プロファイルがありません。「追加」から追加してください。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* === 共通設定タブ === */}
        {activeTab === "general" && (
          <div className="p-5 space-y-6">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                プロキシ URL
              </label>
              <input
                type="text"
                className={`${INPUT_SM} max-w-md`}
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                placeholder="http://proxy:8080"
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Workato・Dify 共通のHTTPプロキシ設定です。不要な場合は空欄にしてください。
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                画面の拡大率
              </label>
              <select
                className={`${SELECT_SM} max-w-[160px]`}
                value={zoomLevel}
                onChange={(e) => handleZoomChange(e.target.value)}
              >
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
              <p className="mt-1.5 text-xs text-gray-400">
                アプリ全体の表示倍率を変更します。
              </p>
            </div>

            {/* データフォルダ（開発者モード時のみ） */}
            {isDev && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  データフォルダ
                </label>
                <div className="flex gap-3">
                  <button
                    className={BTN_OUTLINED_SM}
                    onClick={async () => {
                      const dir = await getLogDir();
                      await openFolder(dir);
                    }}
                  >
                    <FolderOpen size={16} className="text-amber-500" />
                    ログフォルダを開く
                  </button>
                  <button
                    className={BTN_OUTLINED_SM}
                    onClick={async () => {
                      const dir = await getConfigDir();
                      await openFolder(dir);
                    }}
                  >
                    <FolderOpen size={16} className="text-amber-500" />
                    設定フォルダを開く
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 右下 開発者モードトグル */}
      <div className="fixed bottom-6 right-6 flex items-center gap-2">
        <Lock size={12} className="text-gray-400" />
        <span className="text-[11px] text-gray-400">
          {devLocked ? "ロック中" : "開発者モード"}
        </span>
        <button
          onClick={handleDevToggle}
          disabled={!isDev && devLocked}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
            isDev ? "bg-green-500" : "bg-gray-300"
          }`}
          title="開発者モード"
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              isDev ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* 開発者モード パスワードモーダル */}
      <Modal
        open={devModalOpen}
        onClose={() => setDevModalOpen(false)}
        title="開発者モード"
        maxWidth="max-w-sm"
        footer={
          <>
            <button className={BTN_OUTLINED_SM} onClick={() => setDevModalOpen(false)}>
              キャンセル
            </button>
            <button
              className={BTN_PRIMARY}
              disabled={!devPassword || devLocked}
              onClick={async () => {
                await handleDevEnable();
                if (!devLocked) {
                  // handleDevEnable 内で isDev が true になった場合モーダルを閉じる
                  // state 更新は非同期なので localStorage で判定
                  if (localStorage.getItem("developer-mode") === "true") {
                    setDevModalOpen(false);
                  }
                }
              }}
            >
              <Lock size={16} />
              有効化
            </button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            パスワード
          </label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              className={`${INPUT_SM} pl-8`}
              value={devPassword}
              disabled={devLocked}
              onChange={(e) => {
                setDevPassword(e.target.value);
                if (!devLocked) setDevError(null);
              }}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && devPassword && !devLocked) {
                  await handleDevEnable();
                  if (localStorage.getItem("developer-mode") === "true") {
                    setDevModalOpen(false);
                  }
                }
              }}
              placeholder={devLocked ? "ロック中（再起動が必要です）" : "パスワードを入力"}
              autoFocus
            />
          </div>
          {devError && (
            <p className="mt-2 text-xs text-red-500">{devError}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
