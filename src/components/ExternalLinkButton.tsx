// 外部リンクボタン。テキスト + ExternalLink アイコン。

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";

interface Props {
  children: ReactNode;
  onClick: () => void;
}

export default function ExternalLinkButton({ children, onClick }: Props) {
  return (
    <button
      className="inline-flex items-center gap-1 text-primary hover:underline"
      onClick={onClick}
    >
      {children}
      <ExternalLink size={12} className="opacity-50" />
    </button>
  );
}
