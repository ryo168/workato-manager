// 外部依存テーブル。チェックボックス付きで JSON 出力に含めるか選択できる。

import type { ReactNode } from "react";
import { CARD, TABLE, TH, TD, TR_HOVER } from "../lib/tw";

export interface ColumnDef<T> {
  header: string;
  align?: "left" | "right";
  render: (item: T) => ReactNode;
  className?: string;
}

interface Props<T extends { id: number }> {
  title: string;
  note?: string;
  barColor?: string;
  items: T[];
  checkedIds: Set<number>;
  onCheckedChange: (next: Set<number>) => void;
  columns: ColumnDef<T>[];
}

export default function ExternalDependencyTable<T extends { id: number }>({
  title,
  note,
  barColor = "bg-amber-400",
  items,
  checkedIds,
  onCheckedChange,
  columns,
}: Props<T>) {
  if (items.length === 0) return null;

  const allChecked = items.every((item) => checkedIds.has(item.id));
  const noneChecked = items.every((item) => !checkedIds.has(item.id));

  const toggleAll = () => {
    if (allChecked) {
      const next = new Set(checkedIds);
      for (const item of items) next.delete(item.id);
      onCheckedChange(next);
    } else {
      const next = new Set(checkedIds);
      for (const item of items) next.add(item.id);
      onCheckedChange(next);
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(checkedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onCheckedChange(next);
  };

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
        <span className={`h-5 w-1 rounded-full ${barColor}`} />
        {title}
        <span className="text-sm font-normal text-gray-400">
          {items.length} 件
        </span>
      </h2>
      {note && <p className="mb-3 text-xs text-gray-500">{note}</p>}

      <div className={CARD}>
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={`${TH} w-10`}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = !allChecked && !noneChecked;
                  }}
                  onChange={toggleAll}
                  className="accent-violet-400"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.header}
                  className={`${TH}${col.align === "right" ? " text-right" : ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={TR_HOVER}>
                <td className={`${TD} w-10`}>
                  <input
                    type="checkbox"
                    checked={checkedIds.has(item.id)}
                    onChange={() => toggleOne(item.id)}
                    className="accent-violet-400"
                  />
                </td>
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={`${TD}${col.className ? ` ${col.className}` : ""}${col.align === "right" ? " text-right" : ""}`}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
