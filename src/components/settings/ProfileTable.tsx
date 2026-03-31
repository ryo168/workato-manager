// 汎用プロファイルテーブルコンポーネント。
// Workato / Dify / Gemini / Workato File API 共通の CRUD テーブルを描画する。

import React from "react";
import { Check, X, Pencil, Trash2 } from "lucide-react";
import { TABLE, TD, TR_HOVER } from "../../lib/tw";

// ---------- 定数 ----------

/** 共通の列幅 */
export const COL_RADIO = 48;
export const COL_PROXY = 72;
export const COL_ACTIONS = 100;

/** テーブルヘッダー（全テーマ共通・色なし） */
const TH = "px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200";

export type ThemeColor = "orange" | "blue" | "purple" | "indigo" | "cyan";

const THEME: Record<ThemeColor, { th: string; radio: string; activeBg: string; proxyOn: string; toggleOn: string }> = {
  orange: {
    th: TH,
    radio: "appearance-none w-4 h-4 rounded-full border-2 border-gray-300 checked:border-2 checked:border-orange-500 checked:bg-orange-500 checked:shadow-[inset_0_0_0_2px_white] cursor-pointer",
    activeBg: "bg-orange-50/40",
    proxyOn: "bg-orange-100 text-orange-600",
    toggleOn: "bg-orange-500",
  },
  blue: {
    th: TH,
    radio: "appearance-none w-4 h-4 rounded-full border-2 border-gray-300 checked:border-2 checked:border-blue-500 checked:bg-blue-500 checked:shadow-[inset_0_0_0_2px_white] cursor-pointer",
    activeBg: "bg-blue-50/40",
    proxyOn: "bg-blue-100 text-blue-600",
    toggleOn: "bg-blue-500",
  },
  purple: {
    th: TH,
    radio: "appearance-none w-4 h-4 rounded-full border-2 border-gray-300 checked:border-2 checked:border-purple-500 checked:bg-purple-500 checked:shadow-[inset_0_0_0_2px_white] cursor-pointer",
    activeBg: "bg-purple-50/40",
    proxyOn: "bg-purple-100 text-purple-600",
    toggleOn: "bg-purple-500",
  },
  indigo: {
    th: TH,
    radio: "appearance-none w-4 h-4 rounded-full border-2 border-gray-300 checked:border-2 checked:border-indigo-500 checked:bg-indigo-500 checked:shadow-[inset_0_0_0_2px_white] cursor-pointer",
    activeBg: "bg-indigo-50/40",
    proxyOn: "bg-indigo-100 text-indigo-600",
    toggleOn: "bg-indigo-500",
  },
  cyan: {
    th: TH,
    radio: "appearance-none w-4 h-4 rounded-full border-2 border-gray-300 checked:border-2 checked:border-cyan-500 checked:bg-cyan-500 checked:shadow-[inset_0_0_0_2px_white] cursor-pointer",
    activeBg: "bg-cyan-50/40",
    proxyOn: "bg-cyan-100 text-cyan-600",
    toggleOn: "bg-cyan-500",
  },
};

// ---------- 型定義 ----------

/** 列の定義 */
export interface ColumnDef<P, E> {
  header: string;
  width?: number;
  /** 閲覧モードのセル描画 */
  renderView: (profile: P) => React.ReactNode;
  /** 編集モードのセル描画 */
  renderEdit: (editRow: E, setEditRow: React.Dispatch<React.SetStateAction<E>>) => React.ReactNode;
  /** 追加モードのセル描画 */
  renderAdd: (newRow: E, setNewRow: React.Dispatch<React.SetStateAction<E>>) => React.ReactNode;
}

export interface ProfileTableProps<P, E> {
  /** カラーテーマ */
  theme: ThemeColor;
  /** 列定義（ラジオ・Proxy・操作列は自動描画されるので含めない） */
  columns: ColumnDef<P, E>[];
  /** プロファイル一覧 */
  profiles: P[];
  /** 現在アクティブなプロファイル名 */
  activeProfile: string;
  /** プロファイルから名前を取得 */
  getProfileName: (p: P) => string;
  /** アクティブプロファイル変更 */
  onSelectActive: (name: string) => void;

  // --- 編集 ---
  editingIdx: number | null;
  editRow: E;
  setEditRow: React.Dispatch<React.SetStateAction<E>>;
  /** 編集行の use_proxy */
  getEditProxy: (row: E) => boolean;
  setEditProxy: (val: boolean) => void;
  /** 編集行の名前（ラジオ選択用） */
  getEditName: (row: E) => string;
  onStartEdit: (idx: number) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;

  // --- 追加 ---
  adding: boolean;
  newRow: E;
  setNewRow: React.Dispatch<React.SetStateAction<E>>;
  getAddProxy: (row: E) => boolean;
  setAddProxy: (val: boolean) => void;
  onCommitAdd: () => void;
  onCancelAdd: () => void;

  // --- 削除 ---
  onDelete: (idx: number) => void;

  /** プロファイルが空の場合のメッセージ */
  emptyMessage: string;
}

// ---------- コンポーネント ----------

export default function ProfileTable<P, E>({
  theme,
  columns,
  profiles,
  activeProfile,
  getProfileName,
  onSelectActive,
  editingIdx,
  editRow,
  setEditRow,
  getEditProxy,
  setEditProxy,
  getEditName,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  adding,
  newRow,
  setNewRow,
  getAddProxy,
  setAddProxy,
  onCommitAdd,
  onCancelAdd,
  onDelete,
  emptyMessage,
}: ProfileTableProps<P, E>) {
  const t = THEME[theme];
  const totalCols = columns.length + 3; // radio + columns + proxy + actions

  return (
    <table className={TABLE}>
      <thead>
        <tr>
          <th className={t.th} style={{ width: COL_RADIO }} />
          {columns.map((col, i) => (
            <th key={i} className={t.th} style={col.width ? { width: col.width } : undefined}>
              {col.header}
            </th>
          ))}
          <th className={t.th} style={{ width: COL_PROXY }}>Proxy</th>
          <th className={t.th} style={{ width: COL_ACTIONS }} />
        </tr>
      </thead>
      <tbody>
        {profiles.map((p, idx) =>
          editingIdx === idx ? (
            <tr key={idx} className={`group ${t.activeBg}`}>
              {/* ラジオ */}
              <td className={TD}>
                <input
                  type="radio"
                  className={t.radio}
                  checked={activeProfile === getEditName(editRow) || activeProfile === getProfileName(p)}
                  onChange={() => onSelectActive(getEditName(editRow) || getProfileName(p))}
                />
              </td>
              {/* データ列（編集モード） */}
              {columns.map((col, i) => (
                <td key={i} className={TD}>{col.renderEdit(editRow, setEditRow)}</td>
              ))}
              {/* Proxy トグル */}
              <td className={`${TD} text-center`}>
                <ProxyToggle on={getEditProxy(editRow)} color={t.toggleOn} onChange={() => setEditProxy(!getEditProxy(editRow))} />
              </td>
              {/* 操作 */}
              <td className={TD}>
                <ActionButtons onCommit={onCommitEdit} onCancel={onCancelEdit} commitTitle="保存" />
              </td>
            </tr>
          ) : (
            <tr key={idx} className={`group ${TR_HOVER} ${activeProfile === getProfileName(p) ? t.activeBg : ""}`}>
              {/* ラジオ */}
              <td className={TD}>
                <input type="radio" className={t.radio} checked={activeProfile === getProfileName(p)} onChange={() => onSelectActive(getProfileName(p))} />
              </td>
              {/* データ列（閲覧モード） */}
              {columns.map((col, i) => (
                <td key={i} className={TD}>{col.renderView(p)}</td>
              ))}
              {/* Proxy バッジ */}
              <td className={`${TD} text-center`}>
                <ProxyBadge on={!!(p as Record<string, unknown>).use_proxy} onClass={t.proxyOn} />
              </td>
              {/* 操作 */}
              <td className={TD}>
                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="rounded p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100" onClick={() => onStartEdit(idx)} title="編集"><Pencil size={14} /></button>
                  <button className="rounded p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(idx)} title="削除"><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ),
        )}

        {/* 追加行 */}
        {adding && (
          <tr className="group bg-blue-50/40">
            <td className={TD}><input type="radio" className={t.radio} disabled /></td>
            {columns.map((col, i) => (
              <td key={i} className={TD}>{col.renderAdd(newRow, setNewRow)}</td>
            ))}
            <td className={`${TD} text-center`}>
              <ProxyToggle on={getAddProxy(newRow)} color={t.toggleOn} onChange={() => setAddProxy(!getAddProxy(newRow))} />
            </td>
            <td className={TD}>
              <ActionButtons onCommit={onCommitAdd} onCancel={onCancelAdd} commitTitle="追加" />
            </td>
          </tr>
        )}

        {/* 空状態 */}
        {profiles.length === 0 && !adding && (
          <tr>
            <td className={`${TD} text-center text-xs text-gray-400`} colSpan={totalCols}>
              {emptyMessage}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// ---------- 内部サブコンポーネント ----------

function ProxyToggle({ on, color, onChange }: { on: boolean; color: string; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${on ? color : "bg-gray-300"}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
    </button>
  );
}

function ProxyBadge({ on, onClass }: { on: boolean; onClass: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${on ? onClass : "bg-gray-100 text-gray-400"}`}>
      {on ? "ON" : "OFF"}
    </span>
  );
}

function ActionButtons({ onCommit, onCancel, commitTitle }: { onCommit: () => void; onCancel: () => void; commitTitle: string }) {
  return (
    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50" onClick={onCommit} title={commitTitle}><Check size={16} /></button>
      <button className="rounded p-1.5 text-red-400 hover:bg-red-50" onClick={onCancel} title="キャンセル"><X size={16} /></button>
    </div>
  );
}
