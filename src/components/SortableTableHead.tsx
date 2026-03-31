/**
 * @file ソート対応テーブルヘッダーコンポーネント
 * カラム定義配列を渡すだけでソート UI 付きの thead を生成する。
 */

import { ChevronUp, ChevronDown } from "lucide-react";
import { TH } from "../lib/tw";
import type { SortState } from "../lib/sort";

/** テーブルカラムの定義 */
export interface ColumnDef {
  /** ソートキー。未指定の場合はソート不可カラムになる */
  key?: string;
  /** 表示ラベル */
  label: string;
  /** テキスト揃え。デフォルトは left */
  align?: "left" | "center" | "right";
}

interface Props {
  /** カラム定義の配列 */
  columns: ColumnDef[];
  /** 現在のソート状態 */
  sort: SortState;
  /** ソートカラムが変更されたときのコールバック */
  onSort: (col: string) => void;
}

/** align 値を Tailwind クラスに変換するマップ */
const ALIGN_MAP = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

/** ソート可能なテーブルヘッダーを描画する */
export default function SortableTableHead({ columns, sort, onSort }: Props) {
  return (
    <thead>
      <tr>
        {columns.map((col, i) => {
          const align = col.align ?? "left";
          return (
            <th
              key={col.key ?? `col-${i}`}
              className={`${TH} ${ALIGN_MAP[align]}`}
            >
              {col.key ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 transition-colors hover:text-gray-700"
                  onClick={() => onSort(col.key!)}
                >
                  {col.label}
                  <span
                    className={`inline-flex flex-col ${sort.col === col.key ? "opacity-100" : "opacity-0"}`}
                  >
                    {sort.col === col.key && sort.dir === "asc" ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </span>
                </button>
              ) : (
                col.label
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
