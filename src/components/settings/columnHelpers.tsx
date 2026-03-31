// 列定義の共通ヘルパー。名前列など全テーブルで同一のパターンを共通化する。

import type { ColumnDef } from "./ProfileTable";
import { INPUT_SM } from "../../lib/tw";
import { maskToken } from "../../lib/format";

// ---------- 共通型制約 ----------

/** 名前 + 説明を持つプロファイル */
interface WithNameDesc {
  name: string;
  description?: string;
}

/** 名前 + 説明を編集できる EditRow */
interface WithNameDescEdit {
  name: string;
  description: string;
}

// ---------- 名前列（全テーブル共通） ----------

export function createNameColumn<
  P extends WithNameDesc,
  E extends WithNameDescEdit,
>(width = 200): ColumnDef<P, E> {
  return {
    header: "名前",
    width,
    renderView: (p) => (
      <div>
        <div className="text-sm text-gray-500">{p.name}</div>
        {p.description && (
          <div className="text-[11px] text-gray-400 truncate">{p.description}</div>
        )}
      </div>
    ),
    renderEdit: (row, set) => (
      <div className="flex flex-col gap-1">
        <input
          type="text"
          className={INPUT_SM}
          value={row.name}
          onChange={(e) => set((r) => ({ ...r, name: e.target.value }))}
          placeholder="プロファイル名"
        />
        <input
          type="text"
          className={INPUT_SM}
          value={row.description}
          onChange={(e) => set((r) => ({ ...r, description: e.target.value }))}
          placeholder="説明（任意）"
        />
      </div>
    ),
    renderAdd: (row, set) => (
      <div className="flex flex-col gap-1">
        <input
          type="text"
          className={INPUT_SM}
          value={row.name}
          onChange={(e) => set((r) => ({ ...r, name: e.target.value }))}
          placeholder="プロファイル名"
          autoFocus
        />
        <input
          type="text"
          className={INPUT_SM}
          value={row.description}
          onChange={(e) => set((r) => ({ ...r, description: e.target.value }))}
          placeholder="説明（任意）"
        />
      </div>
    ),
  };
}

// ---------- テキスト列ヘルパー ----------

export function createTextColumn<P, E>(
  header: string,
  getView: (p: P) => string,
  editKey: keyof E & string,
  placeholder: string,
  options?: { mono?: boolean; password?: boolean; viewClass?: string },
): ColumnDef<P, E> {
  const viewClass = options?.viewClass ?? "text-xs text-gray-500";
  const monoClass = options?.mono ? "font-mono " : "";
  const inputType = options?.password ? "password" : "text";

  return {
    header,
    renderView: (p) => {
      const val = getView(p);
      const display = options?.password ? maskToken(val) : (val || "-");
      return <span className={`${monoClass}${viewClass}`}>{display}</span>;
    },
    renderEdit: (row, set) => (
      <input
        type={inputType}
        className={INPUT_SM}
        value={String((row as Record<string, unknown>)[editKey] ?? "")}
        onChange={(e) => set((r) => ({ ...r, [editKey]: e.target.value }))}
        placeholder={placeholder}
      />
    ),
    renderAdd: (row, set) => (
      <input
        type={inputType}
        className={INPUT_SM}
        value={String((row as Record<string, unknown>)[editKey] ?? "")}
        onChange={(e) => set((r) => ({ ...r, [editKey]: e.target.value }))}
        placeholder={placeholder}
      />
    ),
  };
}

// ---------- トグル列ヘルパー ----------

/** boolean フィールドのON/OFFバッジ + トグルを描画する列 */
export function createToggleColumn<P, E>(
  header: string,
  getView: (p: P) => boolean,
  editKey: keyof E & string,
  options?: { onLabel?: string; offLabel?: string },
): ColumnDef<P, E> {
  const onLabel = options?.onLabel ?? "ON";
  const offLabel = options?.offLabel ?? "OFF";

  return {
    header,
    width: 80,
    renderView: (p) => {
      const on = getView(p);
      return (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${on ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"}`}>
          {on ? onLabel : offLabel}
        </span>
      );
    },
    renderEdit: (row, set) => {
      const on = !!(row as Record<string, unknown>)[editKey];
      return (
        <button
          type="button"
          onClick={() => set((r) => ({ ...r, [editKey]: !on }))}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${on ? "bg-blue-500" : "bg-gray-300"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
        </button>
      );
    },
    renderAdd: (row, set) => {
      const on = !!(row as Record<string, unknown>)[editKey];
      return (
        <button
          type="button"
          onClick={() => set((r) => ({ ...r, [editKey]: !on }))}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${on ? "bg-blue-500" : "bg-gray-300"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
        </button>
      );
    },
  };
}
