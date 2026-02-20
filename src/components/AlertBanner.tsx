// アラートバナー（エラー、成功、警告、情報）

import type { ReactNode } from "react";

interface Props {
  severity: "error" | "success" | "warning" | "info";
  children: ReactNode;
  className?: string;
}

const STYLES: Record<Props["severity"], string> = {
  error: "border-red-300 bg-red-50 text-red-800",
  success: "border-green-300 bg-green-50 text-green-800",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  info: "border-blue-300 bg-blue-50 text-blue-800",
};

export default function AlertBanner({
  severity,
  children,
  className = "",
}: Props) {
  return (
    <div
      role="alert"
      className={`rounded-lg border px-4 py-3 text-sm ${STYLES[severity]} ${className}`}
    >
      {children}
    </div>
  );
}
