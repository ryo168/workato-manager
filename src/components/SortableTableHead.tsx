// ソートできるテーブルヘッダー。カラム定義を渡すだけで使える。

import { ChevronUp, ChevronDown } from "lucide-react";
import { TH } from "../lib/tw";
import type { SortState } from "../lib/sort";

export interface ColumnDef {
  key?: string; // ソートキー。なければソート不可
  label: string;
  align?: "left" | "center" | "right";
}

interface Props {
  columns: ColumnDef[];
  sort: SortState;
  onSort: (col: string) => void;
}

const ALIGN_MAP = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

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
