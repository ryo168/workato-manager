// コネクション認証状態バッジ。

import { CheckCircle, XCircle } from "lucide-react";

interface Props {
  status: string | undefined;
}

export default function AuthStatusBadge({ status }: Props) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
        <CheckCircle size={14} />
        認証済み
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
      <XCircle size={14} />
      {status ?? "未認証"}
    </span>
  );
}
