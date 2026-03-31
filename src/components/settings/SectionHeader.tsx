// セクションヘッダーコンポーネント。設定ページの各プロファイルセクション上部に表示する。

import { Plus } from "lucide-react";

export interface SectionHeaderProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  /** プロファイル件数（省略時は非表示） */
  count?: number;
  adding?: boolean;
  onAdd?: () => void;
  /** セクションの説明文（任意） */
  description?: string;
}

export default function SectionHeader({ icon, label, color, count, adding, onAdd, description }: SectionHeaderProps) {
  return (
    <div className={`${color} px-4 py-2.5 rounded-t-lg border-b border-gray-200`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold">{label}</span>
          {count != null && (
            <span className="rounded-full bg-gray-200 px-1.5 text-[10px] font-medium text-gray-500">{count}</span>
          )}
        </div>
        {onAdd && (
          <button
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100/60 transition-colors"
            disabled={adding}
            onClick={onAdd}
          >
            <Plus size={14} />
            追加
          </button>
        )}
      </div>
      {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
    </div>
  );
}
