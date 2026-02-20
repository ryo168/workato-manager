// 汎用モーダル。Esc か背景クリックで閉じる。

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { MODAL_BACKDROP, MODAL_PANEL } from "../lib/tw";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** children 側でスクロールを管理する場合 false にする */
  scrollContent?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  maxWidth = "max-w-3xl",
  children,
  footer,
  scrollContent = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={MODAL_BACKDROP} onClick={onClose}>
      <div
        className={`${MODAL_PANEL} w-full ${maxWidth}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* コンテンツ */}
        <div
          className={
            scrollContent
              ? "flex-1 overflow-auto px-5 py-4"
              : "flex flex-1 flex-col overflow-hidden px-5 py-4"
          }
        >
          {children}
        </div>

        {/* フッター */}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
