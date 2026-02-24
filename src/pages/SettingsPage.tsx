// 設定ページ。プロファイルの追加・編集・削除・保存。

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
} from "lucide-react";
import { useProfileEditor } from "../hooks/useProfileEditor";
import { getLogDir, getConfigDir, openFolder } from "../lib/tauri";
import { maskToken } from "../lib/format";
import AlertBanner from "../components/AlertBanner";
import {
  BTN_PRIMARY,
  BTN_OUTLINED_SM,
  BTN_TEXT_SM,
  CARD,
  PAGE,
  HEADER_ROW,
  TABLE,
  TH,
  TD,
  TR_HOVER,
  INPUT_SM,
} from "../lib/tw";

export default function SettingsPage() {
  const {
    profiles,
    activeProfile,
    setActiveProfile,
    editingIdx,
    editRow,
    setEditRow,
    adding,
    newRow,
    setNewRow,
    saving,
    saved,
    error,
    startEdit,
    cancelEdit,
    commitEdit,
    deleteProfile,
    startAdding,
    cancelAdding,
    commitAdd,
    handleSave,
  } = useProfileEditor();

  return (
    <div className={`${PAGE} max-w-5xl`}>
      {/* ヘッダー */}
      <div className={HEADER_ROW}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-200 text-gray-500">
            <Settings size={20} />
          </span>
          <h1 className="text-xl font-bold text-gray-600">Settings</h1>
        </div>
      </div>

      {/* APIプロファイル */}
      <div className={`${CARD} mb-5`}>
        <div className="flex items-center justify-between border-b border-gray-200 bg-orange-50 px-4 py-3 rounded-t-lg">
          <span className="text-sm font-semibold text-orange-700">
            APIプロファイル
          </span>
          <button
            className={BTN_TEXT_SM}
            disabled={adding}
            onClick={startAdding}
          >
            <Plus size={16} />
            新規追加
          </button>
        </div>

        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH} style={{ width: 48 }} />
              <th className={TH}>名前</th>
              <th className={TH}>Base URL</th>
              <th className={TH}>Proxy</th>
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
                      className="h-4 w-4 accent-primary"
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
                      type="text"
                      className={INPUT_SM}
                      value={editRow.proxy_url}
                      onChange={(e) =>
                        setEditRow((r) => ({ ...r, proxy_url: e.target.value }))
                      }
                      placeholder="http://proxy:8080"
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
                      className="h-4 w-4 accent-primary"
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
                  <td className={`${TD} text-xs text-gray-400`}>
                    {p.proxy_url || "-"}
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

            {/* 新規プロファイル行 */}
            {adding && (
              <tr className="group bg-blue-50/40">
                <td className={TD}>
                  <input
                    type="radio"
                    className="h-4 w-4 accent-primary"
                    disabled
                  />
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
                    type="text"
                    className={INPUT_SM}
                    value={newRow.proxy_url}
                    onChange={(e) =>
                      setNewRow((r) => ({ ...r, proxy_url: e.target.value }))
                    }
                    placeholder="http://proxy:8080"
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
          </tbody>
        </table>
      </div>

      {error && (
        <AlertBanner severity="error" className="mb-5">
          {error}
        </AlertBanner>
      )}

      <button className={BTN_PRIMARY} disabled={saving} onClick={handleSave}>
        {saved ? <CheckCircle size={16} /> : <Save size={16} />}
        {saved ? "保存しました" : saving ? "保存中..." : "保存"}
      </button>

      <p className="mt-3 text-xs text-gray-500">
        ラジオボタンでアクティブプロファイルを選択し、「保存」で確定します。
      </p>

      {/* データフォルダショートカット */}
      <div className={`${CARD} mt-10`}>
        <div className="border-b border-gray-200 bg-orange-50 px-4 py-3 rounded-t-lg">
          <span className="text-sm font-semibold text-orange-700">
            データフォルダ
          </span>
        </div>
        <div className="flex gap-3 p-4">
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
    </div>
  );
}
